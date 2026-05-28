/**
 * ============================================================================
 *  BALANCE — Fichier UNIQUE de toutes les valeurs numériques du jeu.
 * ============================================================================
 *  Règle : AUCUN nombre "magique" ailleurs dans le code. Tout l'équilibrage
 *  du jeu se fait en itérant sur ce seul fichier.
 *
 *  Toutes les valeurs "par seconde" sont appliquées via tick(state, dt) où dt
 *  est exprimé en SECONDES (le pas de simulation est défini ci-dessous).
 * ============================================================================
 */
export const BALANCE = {
  /** Boucle de simulation. */
  simulation: {
    /** Pas de temps fixe de la simulation, en millisecondes.
     *  Petit = plus fluide / déterministe ; on accumule le delta réel. */
    fixedStepMs: 100,
  },

  /** Ressources de départ et économie globale. */
  resources: {
    /** CASH au démarrage. Game over si CASH <= 0 ("Faillite"). */
    startingCash: 10000,
  },

  /**
   * Revenu : les clients ne paient PAS en continu, mais par "versements"
   * périodiques. C'est la SEULE source de revenu du jeu.
   */
  revenue: {
    /** Période entre deux versements (secondes) : un client paie toutes les 10s. */
    billingCycleSec: 10,
    /** Montant CASH reçu d'un client à chaque versement. */
    cashPerPayment: 100,
  },

  /**
   * Cycle de vie d'un client : à l'acquisition il tire un nombre aléatoire de
   * versements (récurrence) dans [minPayments, maxPayments]. À chaque versement
   * ce compteur décroît ; à 0 le client part (churn) et ne rapporte plus.
   */
  clientLifecycle: {
    minPayments: 1,
    maxPayments: 10,
  },

  /** Employés (cofounders — salaire de base). */
  employee: {
    /** Salaire payé par cofounder par seconde. */
    salaryPerSec: 9,
  },

  /**
   * Paie : les salaires sont versés en une seule pulsation périodique,
   * pas en flux continu — le joueur voit le montant arriver d'un coup.
   */
  payroll: {
    /** Période entre deux versements de salaires (secondes). */
    cycleSec: 30,
  },

  /**
   * Profils de recrutement disponibles depuis les départements.
   * Chaque recrue est directement assignée à la zone depuis laquelle on recrute.
   */
  profiles: {
    stagiaire: {
      cashCost: 150,
      brandCost: 0,
      salaryPerSec: 5,
      /** La zone produit à demi-vitesse. */
      productionMultiplier: 0.5,
    },
    manager: {
      cashCost: 400,
      brandCost: 0,
      salaryPerSec: 12,
      /** Production nominale. */
      productionMultiplier: 1.0,
    },
    headOf: {
      cashCost: 900,
      /** Coût additionnel en BRAND (réputation nécessaire pour attirer le talent). */
      brandCost: 15,
      salaryPerSec: 20,
      /** La zone produit au double du rythme nominal. */
      productionMultiplier: 2.0,
    },
  },

  /** Zones de département (1 case = 1 zone = 1 employé max). */
  zones: {
    engineering: {
      /** Coût CASH pour construire une zone Engineering. */
      buildCost: 250,
      /** TECH produite par seconde si un employé y est assigné.
       *  Réglage actuel : 1 TECH toutes les 5s. */
      techPerSec: 1 / 5,
    },
    marketing: {
      /** Coût CASH pour construire une zone Marketing. */
      buildCost: 350,
      /** BRAND produite par seconde si un employé y est assigné.
       *  Réglage actuel : 1 BRAND toutes les 30s. */
      brandPerSec: 1 / 30,
      /** CASH consommé par seconde pendant que la zone produit. */
      cashCostPerSec: 5,
    },
    sales: {
      /** Coût CASH pour construire une zone Sales. */
      buildCost: 350,
      /** Clients acquis par seconde SANS Brand (rythme de base, lent).
       *  Requiert que le MVP soit lancé.
       *  Réglage actuel : 1 client toutes les 30s. */
      baseClientsPerSec: 1 / 30,
      /** Multiplicateur d'acquisition apporté par la Brand :
       *  rythme = base * (1 + BRAND * brandMultiplierPerBrand). */
      brandMultiplierPerBrand: 0.04,
      /** BRAND consommée par seconde, par zone Sales active, tant que la
       *  Brand booste l'acquisition (BRAND > 0). */
      brandConsumedPerSec: 3,
    },
  },

  /** Jalon produit. */
  product: {
    /** TECH nécessaire pour rendre actif le bouton "Lancer le MVP".
     *  Tant que le MVP n'est pas lancé, Sales n'acquiert aucun client. */
    mvpTechThreshold: 100,
  },

  /** Réputation (BRAND). */
  brand: {
    /** BRAND perdue par seconde s'il n'y a AUCUN marketing actif (decay). */
    decayPerSec: 1.5,
    /** Plafond de BRAND. */
    max: 100,
  },

  /**
   * Bureaux (V1 : 2 niveaux). Le plafond de population vient DU BUREAU.
   * On indexe par niveau ('garage' | 'office') ; relocateCost est à part.
   */
  offices: {
    garage: {
      rows: 2,
      cols: 2,
      /** Plafond de population (nombre max d'employés). */
      populationCap: 4,
    },
    office: {
      rows: 5,
      cols: 5,
      populationCap: 12,
    },
    /** Coût CASH du "Déménager" (Garage -> Bureau). Les zones sont conservées. */
    relocateCost: 6000,
  },

  /** État initial de la partie. */
  start: {
    /** Nombre de cofounders non assignés au démarrage. */
    cofounders: 2,
    /** Zone Engineering déjà posée au démarrage (coords grille row/col). */
    initialEngineeringZone: { row: 0, col: 0 },
  },
} as const;

/** Type dérivé de la config — passé explicitement à la logique (testable). */
export type Balance = typeof BALANCE;
