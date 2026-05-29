import type { Balance } from '../config/balance';
import { createClient } from './client';
import type { GameState } from './gamestate';

/**
 * Avance la simulation d'un pas de dt SECONDES.
 * Fonction pure côté logique (mute l'état passé), sans aucune dépendance
 * au rendu. C'est le coeur temps réel du jeu.
 */
export function tick(s: GameState, dt: number, b: Balance): void {
  if (s.gameOver || s.paused) return;

  const r = s.resources;
  let marketingActive = false;
  let clientAccrualThisTick = 0;

  // 1) Construction des zones en cours, puis production.
  for (const zone of s.zones) {
    if (zone.buildSecondsRemaining > 0) {
      zone.buildSecondsRemaining = Math.max(0, zone.buildSecondsRemaining - dt);
      continue; // zone pas encore opérationnelle
    }
    if (zone.assignedEmployeeId === null) continue;

    const emp = s.employees.find((e) => e.id === zone.assignedEmployeeId);
    const prodMult = emp?.productionMultiplier ?? 1;

    switch (zone.type) {
      case 'engineering': {
        r.tech += b.zones.engineering.techPerSec * prodMult * dt;
        break;
      }
      case 'marketing': {
        r.cash -= b.zones.marketing.cashCostPerSec * dt;
        r.brand = Math.min(b.brand.max, r.brand + b.zones.marketing.brandPerSec * prodMult * dt);
        marketingActive = true;
        break;
      }
      case 'sales': {
        // Sales n'acquiert des clients qu'après le lancement du MVP.
        if (!s.flags.mvpLaunched) break;
        let multiplier = 1;
        if (r.brand > 0) {
          // La Brand accélère l'acquisition MAIS se consomme en le faisant.
          multiplier = 1 + r.brand * b.zones.sales.brandMultiplierPerBrand;
          r.brand = Math.max(0, r.brand - b.zones.sales.brandConsumedPerSec * dt);
        }
        clientAccrualThisTick += b.zones.sales.baseClientsPerSec * prodMult * multiplier * dt;
        break;
      }
    }
  }

  // 2) Decay de la Brand s'il n'y a aucun marketing actif.
  if (!marketingActive) {
    r.brand = Math.max(0, r.brand - b.brand.decayPerSec * dt);
  }

  // 3) Acquisition de clients : on accumule la fraction puis on crée des
  //    clients ENTIERS. Chaque nouveau client tire son nombre de versements.
  s.clientAccrual += clientAccrualThisTick;
  while (s.clientAccrual >= 1) {
    s.clientAccrual -= 1;
    const { minPayments, maxPayments } = b.clientLifecycle;
    const span = maxPayments - minPayments + 1;
    const payments = minPayments + Math.floor(Math.random() * span);
    s.clients.push(createClient(s.nextClientId++, payments));
  }

  // 4) Versements périodiques : toutes les billingCycleSec, chaque client paie
  //    cashPerPayment, son compteur décroît, et il churn quand il atteint 0.
  s.billingTimerSec += dt;
  while (s.billingTimerSec >= b.revenue.billingCycleSec) {
    s.billingTimerSec -= b.revenue.billingCycleSec;
    for (const c of s.clients) {
      r.cash += s.mvpRevenuePerPayment;
      c.paymentsRemaining -= 1;
    }
    s.clients = s.clients.filter((c) => c.paymentsRemaining > 0);
  }

  // 5) Salaires (pulsés toutes les payroll.cycleSec, comme les versements clients).
  s.payrollTimerSec += dt;
  while (s.payrollTimerSec >= b.payroll.cycleSec) {
    s.payrollTimerSec -= b.payroll.cycleSec;
    const salaries = s.employees.reduce((sum, e) => sum + e.salaryPerSec, 0);
    r.cash -= salaries * b.payroll.cycleSec;
  }

  // 6) Timer de survie.
  s.elapsedSec += dt;

  // 7) Faillite.
  if (r.cash <= 0) {
    r.cash = 0;
    s.gameOver = true;
    s.gameOverReason = 'Faillite';
  }
}
