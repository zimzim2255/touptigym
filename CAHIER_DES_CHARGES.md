# Cahier des Charges — Application de Gestion "TOUP TI GYM"

## 1. Présentation Générale

### 1.1. Description
Application de gestion complète pour une salle de sport/gymnase pour enfants. Elle couvre :
- La gestion administrative (enfants, parents, abonnements, encaissements)
- La gestion sportive (exercices, entraîneurs, présences)
- Le contrôle d'accès physique via ZKTeco SpeedFace-V5L
- La gestion des présences et absences automatisée

### 1.2. Public Cible
- **Administrateur** : Gestion complète de l'établissement
- **Employé (Worker)** : Gestion opérationnelle quotidienne
- **Entraîneur (Trainer/Coach)** : Suivi des séances et des présences
- **Parent** : Suivi de son enfant (consultation)

---

## 2. Modules et Pages de l'Application

### 2.1. Page de Sélection de Rôle
- Sélection du profil : Administrateur / Employé / Entraîneur
- Mode démo pour la présentation

### 2.2. Dashboard Administrateur
Pages incluses :
1. **Gestion des Enfants** — Liste + CRUD
2. **Gestion des Parents** — Liste + CRUD
3. **Gestion des Abonnements** — Création, suivi, confirmation
4. **Gestion des Exercices** — Création des séances sportives
5. **Gestion des Entraîneurs** — CRUD avec création de compte
6. **Demandes Urgentes** — Validation/Rejet
7. **Gestion des Absences** — Historique complet
8. **Gestion des Chèques** — Encaissements
9. **Gestion des Utilisateurs** — Création des comptes (admin, worker, trainer)
10. **Tarifs & Paramètres** — Configuration des prix, réductions, horaires

### 2.3. Dashboard Employé (Worker)
Pages incluses :
1. **Gestion des Enfants**
2. **Gestion des Parents**
3. **Création d'Abonnements** (soumis à validation admin)
4. **Demandes Urgentes**

### 2.4. Dashboard Entraîneur (Trainer)
Pages incluses :
1. **Mes Exercices du Jour** — Liste des séances programmées
2. **Marquer la Présence** — Pointage manuel des enfants
3. **Exercices à Venir** — Planning prévisionnel
4. **Créer une Demande Urgente**
5. **Créer un Exercice**
6. **Consulter les Présences/Absences** de ses séances

### 2.5. Portail Parent (à développer)
- Consultation des informations de son enfant
- Historique des présences/absences
- Historique des abonnements et paiements
- Notification en cas d'absence

---

## 3. Grille Tarifaire (ÉDITABLE)

### 3.1. Tarifs des Abonnements

| Activités | Session (24 semaines) | Année (48 semaines) |
|-----------|----------------------|-------------------:|
| 1 activité/semaine | 3 900 Dhs | 6 600 Dhs |
| 2 activités/semaine | 6 300 Dhs | 10 200 Dhs |
| 3 activités/semaine | 8 100 Dhs | 13 800 Dhs |
| 4 activités/semaine | 9 300 Dhs | 16 200 Dhs |

### 3.2. Frais Supplémentaires
- **Droit d'entrée** : 700 Dhs (éditable)
- **Assurance et carte membre** : 300 Dhs (éditable)

### 3.3. Réductions (Remises)
- **-10%** : Inscription du deuxième enfant
- **-20%** : Inscription du troisième enfant
- **Remise personnalisée** : Option de remise libre pour cas spéciaux (anniversaire, fidélité, promotion)

### 3.4. Configuration
- Tous les tarifs doivent être modifiables depuis l'interface admin
- Les réductions doivent être paramétrables (pourcentage et conditions)
- Possibilité d'ajouter/supprimer des lignes de tarifs
- Historique des modifications de prix

---

## 4. Intégration ZKTeco SpeedFace-V5L — Contrôle d'Accès

### 4.1. Principe Général
Le ZKTeco SpeedFace-V5L est un lecteur biométrique (reconnaissance faciale) qui fonctionne **en ligne et hors ligne**. L'application doit s'intégrer avec cet appareil pour gérer les accès à la salle de sport.

### 4.2. Fonctionnement du Système

#### A. Création d'un Client (Enfant)
1. Lors de l'inscription d'un enfant, l'administrateur saisit un **ID client** dans l'application
2. Cet ID est généré depuis le ZKTeco SpeedFace-V5L (l'appareil crée un identifiant unique pour chaque visage enregistré)
3. L'ID ZKTeco est associé au profil de l'enfant dans l'application
4. L'administrateur définit les **jours et horaires d'accès autorisés** pour cet enfant (en fonction de son abonnement)

#### B. Horaires d'Accès
- Chaque enfant a des **créneaux horaires définis** (ex : lundi 14h-16h, mercredi 10h-12h)
- **Tolérance d'entrée** :
  - L'enfant peut entrer **15 minutes avant** son horaire prévu
  - L'enfant peut entrer **jusqu'à 30 minutes après** son horaire prévu
  - Exemple : Séance à 12h00 → Accès autorisé de 11h45 à 12h30
- En dehors de cette fenêtre, l'accès est refusé

#### C. Fonctionnement du Scan Facial
1. L'enfant se présente devant le ZKTeco SpeedFace-V5L
2. L'appareil scanne son visage
3. L'application interroge le ZKTeco pour vérifier si le visage correspond à un ID client existant dans la base de données
4. Si l'ID existe :
   - Vérification du jour et de l'heure d'accès autorisés
   - Si dans la fenêtre de tolérance → **Accès autorisé** (porte déverrouillée)
   - Si en dehors → **Accès refusé**
5. Si l'ID n'existe pas → **Accès refusé**

#### D. Gestion des Présences et Absences
- Si l'enfant **entre** dans la salle dans sa fenêtre horaire → **Marqué "Présent"** automatiquement
- Si l'enfant **ne se présente pas** durant sa fenêtre horaire → **Marqué "Absent"** automatiquement
- Si l'enfant entre mais ne passe pas la séance complète → Marqué "Départ anticipé"
- Historique complet de tous les passages (date, heure d'entrée, heure de sortie)

#### E. Tableau de Bord de Contrôle d'Accès
- Vue en temps réel des entrées/sorties du jour
- Statistiques : taux de présence, retards, absences
- Alertes en cas d'accès refusé (tentative d'intrusion)
- Export des rapports d'accès

### 4.3. Gestion en Mode Hors Ligne
- Le ZKTeco SpeedFace-V5L stocke localement les visages enregistrés
- En mode hors ligne, l'appareil fonctionne de manière autonome :
  - Scan facial possible sans connexion internet
  - Les logs d'accès sont stockés localement sur l'appareil
  - Synchronisation automatique des logs lorsque la connexion est rétablie
- L'application doit gérer un cache local des horaires d'accès pour rester fonctionnelle

### 4.4. Schéma de Données pour le Contrôle d'Accès
- **Table : zkteco_devices** — Liste des appareils (ID, nom, adresse IP, statut)
- **Table : access_schedules** — Plannings d'accès (enfant_id, jour_semaine, heure_debut, heure_fin)
- **Table : access_logs** — Historique des passages (enfant_id, appareil_id, date_heure, type: entrée/sortie, statut: autorisé/refusé)
- **Table : absences** — Absences enregistrées (enfant_id, seance_id, date, type: abs/retard, justifié: oui/non)

### 4.5. Impact sur les Abonnements
- Lors de la création d'un abonnement, les créneaux d'accès sont automatiquement définis en fonction des exercices sélectionnés
- Modification possible des créneaux par l'administrateur
- Un abonnement actif = accès autorisé. Un abonnement expiré = accès bloqué automatiquement

---

## 5. Gestion des Paiments

### 5.1. Types de Paiement Acceptés
- **Espèces (Cash)** — Enregistrement manuel
- **Chèque** — Saisie des informations (numéro, banque, montant, titulaire)
- **Virement bancaire** — Suivi des virements reçus

### 5.2. Suivi des Chèques
- Enregistrement : numéro, banque, titulaire, montant, date
- Statut : Disponible / Utilisé
- Scan/photo du chèque (optionnel)

### 5.3. Règlement des Abonnements
- Possibilité de payer en plusieurs fois (max 2 moyens de paiement)
- Encaissement du droit d'entrée une fois
- Assurance et carte membre à chaque renouvellement annuel

---

## 6. Base de Données (Tables SQL)

### 6.1. Table : utilisateurs
| Champ | Type | Description |
|-------|------|-------------|
| id | UUID | Identifiant unique |
| email | VARCHAR | Email de connexion |
| nom | VARCHAR | Nom complet |
| role | ENUM | admin / worker / trainer / parent |
| mot_de_passe | VARCHAR | Hash du mot de passe |
| trainer_id | UUID | Référence entraîneur (si rôle trainer) |
| cree_le | TIMESTAMP | Date de création |

### 6.2. Table : enfants
| Champ | Type | Description |
|-------|------|-------------|
| id | UUID | Identifiant unique |
| nom | VARCHAR | Nom complet |
| genre | ENUM | Garçon / Fille |
| date_naissance | DATE | Date de naissance |
| age | INT | Âge calculé |
| ecole | VARCHAR | Nom de l'école |
| type_ecole | VARCHAR | Bilingue / Mission / Autre |
| adresse | TEXT | Adresse |
| code_postal | VARCHAR | Code postal |
| type_client | ENUM | Normal / VIP |
| zkteco_id | VARCHAR | ID généré par le ZKTeco |
| photo | TEXT | URL de la photo |
| cree_le | TIMESTAMP | Date de création |

### 6.3. Table : parents
| Champ | Type | Description |
|-------|------|-------------|
| id | UUID | Identifiant unique |
| nom | VARCHAR | Nom complet |
| telephone | VARCHAR | Numéro de téléphone |
| email | VARCHAR | Email |
| cin | VARCHAR | Carte d'identité nationale |
| cree_le | TIMESTAMP | Date de création |

### 6.4. Table : parent_enfants
| Champ | Type | Description |
|-------|------|-------------|
| parent_id | UUID | Référence parent |
| enfant_id | UUID | Référence enfant |

### 6.5. Table : tarifs
| Champ | Type | Description |
|-------|------|-------------|
| id | UUID | Identifiant unique |
| type | VARCHAR | abonnement / frais_entree / assurance |
| activites | INT | Nombre d'activités/semaine |
| duree | VARCHAR | session / annee |
| montant | DECIMAL | Prix |
| modifiable | BOOLEAN | Peut être modifié depuis l'interface |

### 6.6. Table : reductions (remises)
| Champ | Type | Description |
|-------|------|-------------|
| id | UUID | Identifiant unique |
| nom | VARCHAR | Libellé (ex: "2ème enfant") |
| type | ENUM | pourcentage / montant_fixe |
| valeur | DECIMAL | Valeur de la réduction |
| condition | TEXT | Condition d'application |
| actif | BOOLEAN | Réduction active ou non |

### 6.7. Table : abonnements
| Champ | Type | Description |
|-------|------|-------------|
| id | UUID | Identifiant unique |
| enfant_id | UUID | Référence enfant |
| type | VARCHAR | Mensuel / Trimestriel / Annuel |
| sous_type | VARCHAR | Forfait (ex: "1 enf / 2 Act") |
| montant | DECIMAL | Montant total |
| remise | DECIMAL | Réduction appliquée |
| assurance | DECIMAL | Montant assurance |
| frais_entree | DECIMAL | Droit d'entrée |
| statut | ENUM | actif / en_attente / expiré / résilié |
| exercices | UUID[] | Liste des exercices inclus |
| date_debut | DATE | Début de validité |
| date_fin | DATE | Fin de validité |
| cree_par | UUID | Utilisateur créateur |
| confirme_par | UUID | Admin confirmateur |
| cree_le | TIMESTAMP | Date de création |

### 6.8. Table : exercices
| Champ | Type | Description |
|-------|------|-------------|
| id | UUID | Identifiant unique |
| nom | VARCHAR | Nom de l'exercice |
| jour | VARCHAR | Jour de la semaine |
| type | VARCHAR | Football / Basketball / Swimming / Gymnastics / Other |
| date_debut | DATE | Date de début |
| date_fin | DATE | Date de fin |
| heure_debut | TIME | Heure de début |
| heure_fin | TIME | Heure de fin |
| coach_id | UUID | Référence entraîneur |
| prix | DECIMAL | Prix de la séance |

### 6.9. Table : entraineurs
| Champ | Type | Description |
|-------|------|-------------|
| id | UUID | Identifiant unique |
| user_id | UUID | Référence compte utilisateur |
| nom | VARCHAR | Nom complet |
| date_naissance | DATE | Date de naissance |
| cin | VARCHAR | Carte d'identité |
| photo | TEXT | URL photo |
| email | VARCHAR | Email |
| telephone | VARCHAR | Téléphone |
| specialite | VARCHAR | Spécialité sportive |
| cree_le | TIMESTAMP | Date de création |

### 6.10. Table : paiements
| Champ | Type | Description |
|-------|------|-------------|
| id | UUID | Identifiant unique |
| abonnement_id | UUID | Référence abonnement |
| montant | DECIMAL | Montant payé |
| methode | VARCHAR[] | Cash / Chèque / Virement |
| cheque_ids | UUID[] | Références chèques |
| cree_le | TIMESTAMP | Date du paiement |

### 6.11. Table : cheques
| Champ | Type | Description |
|-------|------|-------------|
| id | UUID | Identifiant unique |
| numero | VARCHAR | Numéro du chèque |
| montant | DECIMAL | Montant |
| banque | VARCHAR | Nom de la banque |
| titulaire | VARCHAR | Titulaire du compte |
| utilise | BOOLEAN | Chèque utilisé ou non |
| paiement_id | UUID | Référence paiement |
| fichier | TEXT | Scan/photo du chèque |
| cree_le | TIMESTAMP | Date de création |

### 6.12. Table : appareils_zkteco
| Champ | Type | Description |
|-------|------|-------------|
| id | UUID | Identifiant unique |
| nom | VARCHAR | Nom de l'appareil |
| adresse_ip | VARCHAR | Adresse IP |
| port | INT | Port de connexion |
| statut | ENUM | en_ligne / hors_ligne / maintenance |
| emplacement | VARCHAR | Emplacement physique |
| dernier_log | TIMESTAMP | Dernière communication |

### 6.13. Table : plannings_acces
| Champ | Type | Description |
|-------|------|-------------|
| id | UUID | Identifiant unique |
| enfant_id | UUID | Référence enfant |
| jour_semaine | INT | 0=Dimanche, 1=Lundi... |
| heure_debut | TIME | Heure de début autorisée |
| heure_fin | TIME | Heure de fin autorisée |
| fenetre_avant | INT | Minutes avant (défaut: 15) |
| fenetre_apres | INT | Minutes après (défaut: 30) |

### 6.14. Table : logs_acces
| Champ | Type | Description |
|-------|------|-------------|
| id | UUID | Identifiant unique |
| enfant_id | UUID | Référence enfant |
| appareil_id | UUID | Référence appareil ZKTeco |
| date_heure | TIMESTAMP | Date et heure du passage |
| type | ENUM | entree / sortie |
| statut | ENUM | autorise / refusé / erreur |
| motif_refus | VARCHAR | Motif si refusé |
| mode | ENUM | en_ligne / hors_ligne |

### 6.15. Table : absences
| Champ | Type | Description |
|-------|------|-------------|
| id | UUID | Identifiant unique |
| enfant_id | UUID | Référence enfant |
| exercice_id | UUID | Référence exercice/séance |
| date | DATE | Date de l'absence |
| type | ENUM | absence / retard / depart_anticipe |
| justifie | BOOLEAN | Absence justifiée ou non |
| justificatif | TEXT | Motif ou justificatif |
| cree_le | TIMESTAMP | Date d'enregistrement |

### 6.16. Table : demandes_urgentes
| Champ | Type | Description |
|-------|------|-------------|
| id | UUID | Identifiant unique |
| enfant_id | UUID | Référence enfant |
| exercice_id | UUID | Référence exercice |
| date | DATE | Date concernée |
| notes | TEXT | Description de la demande |
| statut | ENUM | en_attente / approuvée / rejetée |
| cree_par | UUID | Créateur de la demande |
| cree_le | TIMESTAMP | Date de création |

---

## 7. Fonctionnalités Clés

### 7.1. Inscription et Abonnement
- Sélection du type d'abonnement avec tarifs dynamiques
- Application automatique des réductions fratrie
- Remise personnalisable (montant fixe ou pourcentage)
- Intégration des créneaux d'accès ZKTeco dans l'abonnement
- Génération du planning d'accès automatique selon les exercices choisis

### 7.2. Contrôle d'Accès
- Synchronisation avec le ZKTeco SpeedFace-V5L
- Gestion des plages horaires par enfant
- Tolérance d'entrée configurable (avant/après)
- Mode hors ligne avec cache local
- Logs de tous les passages
- Statistiques de fréquentation

### 7.3. Gestion des Présences
- Marquage automatique via ZKTeco
- Marquage manuel par l'entraîneur (pour les séances)
- Détection des absences automatique
- Historique complet avec filtres
- Notifications aux parents en cas d'absence

### 7.4. Dashboard et Rapports
- Tableau de bord avec indicateurs clés
- Taux de présence par enfant / par exercice
- État des encaissements
- Liste des abonnements expirés ou en attente
- Alertes et notifications

---

## 8. Intégration Technique avec ZKTeco SpeedFace-V5L (PUSH SDK)

### 8.1. Protocole de Communication
Le ZKTeco SpeedFace-V5L utilise le **PUSH SDK Protocol v2.0.1** — un protocole HTTP où l'appareil initie la communication avec le serveur.

### 8.2. Architecture de Communication

```
┌─────────────────┐         HTTP/HTTPS          ┌──────────────────┐
│  ZKTeco          │ ◄─────────────────────────► │  Serveur         │
│  SpeedFace-V5L   │                             │  (Backend App)   │
│                  │                             │                  │
│  - Scan facial   │                             │  - API REST      │
│  - Stockage local│                             │  - Base de données│
│  - Cache offline │                             │  - Logs d'accès  │
└─────────────────┘                             └──────────────────┘
         │                                                │
         │                                                │
         ▼                                                ▼
┌─────────────────┐                             ┌──────────────────┐
│  Base locale     │                             │  Base de données │
│  (visages, logs) │                             │  Supabase/Postgres│
└─────────────────┘                             └──────────────────┘
```

### 8.3. Flux de Communication

#### Étape 1 : Configuration Initiale
L'appareil envoie une requête GET au serveur pour lire sa configuration :
```
GET /iclock/cdata?SN=XXXXXX&options=all&pushver=2.0.1&language=XX
```
Le serveur répond avec les paramètres de communication (intervalles, types de données autorisées, etc.)

#### Étape 2 : Envoi des Données d'Authentification (Attendance Log)
Quand un enfant scanne son visage, l'appareil envoie :
```
POST /iclock/cdata?SN=XXXXXX&table=ATTLOG&Stamp=99999999
PIN=12345\t2026-07-22 14:30:00\t1\t1
```
- **PIN** : ID ZKTeco de l'enfant
- **TIME** : Date et heure du scan
- **STATUS** : 0=Entrée, 1=Sortie
- **VERIFY** : 0=Mot de passe, 1=Empreinte, 2=Carte, 9=Visage

#### Étape 3 : Vérification et Réponse
Le serveur reçoit le log, vérifie dans la base de données :
1. Si le PIN existe dans la table `enfants` (champ `zkteco_id`)
2. Si l'enfant a un abonnement actif
3. Si l'horaire correspond à un créneau autorisé (avec tolérance ±15min/+30min)
4. **Retourne "OK"** si accès autorisé, ou refuse silencieusement

#### Étape 4 : Commandes du Serveur vers l'Appareil
L'appareil interroge périodiquement le serveur :
```
GET /iclock/getrequest?SN=XXXXXX
```
Le serveur peut retourner des commandes :
- `DATA USER PIN=%d...` → Ajouter/modifier un utilisateur (visage)
- `DATA DEL_USER PIN=%d` → Supprimer un utilisateur
- `AC_UNLOCK` → Déverrouiller la porte
- `REBOOT` → Redémarrer l'appareil
- `CLEAR LOG` → Vider les logs
- `SET OPTION IPAddress=...` → Configurer l'appareil

### 8.4. Synchronisation des Utilisateurs (Visages)

#### Ajout d'un enfant dans l'application :
1. L'admin crée l'enfant dans l'interface web
2. L'admin enregistre le visage sur le ZKTeco (via l'appareil ou l'API)
3. Le ZKTeco génère un **PIN** (ID unique)
4. L'admin saisit ce PIN dans le profil de l'enfant sur l'application
5. L'application envoie une commande au ZKTeco pour associer les horaires d'accès :
   ```
   DATA USER PIN=12345\tName=EnfantX\tGrp=1\tTZ=1
   ```
6. Les horaires d'accès sont configurés via les Time Zones (TZ)

### 8.5. Gestion des Time Zones (Plages Horaires)
Le ZKTeco utilise des **Time Zones** pour définir les plages d'accès :
```
UPDATE TIMEZONE TZID=1\tITIME=08:00-17:00\tRESERVE=
```
- Chaque enfant est associé à une Time Zone via le champ `TZ`
- L'application doit convertir les créneaux d'abonnement en Time Zones ZKTeco
- Exemple : Séance lundi 14h-16h → Time Zone avec accès 13h45-16h30 (avec tolérances)

### 8.6. Gestion des Logs et des Absences

#### Logs d'accès reçus du ZKTeco :
```
POST /iclock/cdata?SN=XXXXXX&table=ATTLOG&Stamp=99999999
PIN=12345\t2026-07-22 14:30:00\t1\t1
PIN=12345\t2026-07-22 16:00:00\t1\t0
```

#### Traitement côté serveur :
1. Réception du log d'entrée → Vérification des droits d'accès
2. Si autorisé → Enregistrement dans `logs_acces` + Marquage "Présent" dans `absences`
3. Si refusé → Enregistrement dans `logs_acces` avec statut "refusé" + motif
4. À la fin de chaque créneau, vérification automatique :
   - Si aucun log d'entrée reçu → Marquage "Absent" automatique
   - Si entrée mais pas de sortie → Marquage "Départ anticipé"

### 8.7. Mode Hors Ligne

#### Fonctionnement autonome du ZKTeco :
- Les visages enregistrés sont stockés localement sur l'appareil
- Les logs d'accès sont accumulés dans la mémoire interne
- Les décisions d'accès (autorisé/refusé) sont prises localement selon :
  - La liste des utilisateurs enregistrés (visages)
  - Les plages horaires configurées (Time Zones)
  - Les tolérances d'entrée

#### Synchronisation au retour de la connexion :
1. L'appareil détecte le retour de la connexion réseau
2. Il envoie tous les logs accumulés via `POST /iclock/cdata?table=ATTLOG`
3. Le serveur traite les logs et met à jour la base de données
4. L'appareil vide son buffer de logs après confirmation

### 8.8. Commandes Supportées par l'API

| Commande | Description | Utilisation |
|----------|-------------|-------------|
| `DATA USER` | Ajouter/modifier un utilisateur | Création d'enfant |
| `DATA DEL_USER` | Supprimer un utilisateur | Suppression d'enfant |
| `DATA FP` | Ajouter une empreinte | Enregistrement biométrique |
| `ENROLL_FP` | Lancer l'enrôlement | Inscription sur l'appareil |
| `UPDATE TIMEZONE` | Configurer plage horaire | Définition des accès |
| `DELETE TIMEZONE` | Supprimer plage horaire | Désactivation d'accès |
| `UPDATE USERPIC` | Télécharger photo | Mise à jour visage |
| `DELETE USERPIC` | Supprimer photo | Suppression visage |
| `AC_UNLOCK` | Déverrouiller porte | Ouverture à distance |
| `AC_UNALARM` | Annuler alarme | Désactivation alarme |
| `QUERY ATTLOG` | Consulter logs | Historique des passages |
| `CLEAR LOG` | Vider les logs | Nettoyage |
| `REBOOT` | Redémarrer | Maintenance |
| `SET OPTION` | Configurer appareil | Paramétrage réseau/IP |
| `GET OPTION` | Lire configuration | État de l'appareil |
| `INFO` | Infos appareil | Diagnostic |
| `CHECK` | Vérifier nouvelles données | Synchronisation |
| `LOG` | Forcer envoi données | Mise à jour immédiate |

### 8.9. Format des Données Échangées

#### Envoi d'un log d'accès (Attendance Record) :
```
POST /iclock/cdata?SN=ABC123&table=ATTLOG&Stamp=123456789
PIN=1001\t2026-07-22 14:30:00\t1\t1
```
- **PIN** : ID ZKTeco de l'utilisateur
- **TIME** : Horodatage du scan
- **STATUS** : 0=Entrée, 1=Sortie, 2=Entrée pause, 3=Sortie pause
- **VERIFY** : 0=Password, 1=Fingerprint, 2=Card, 9=Face

#### Envoi d'une photo de vérification (Attendance Photo) :
```
POST /iclock/cdata?SN=ABC123&table=ATTPHOTO&Stamp=123456789
PIN=20260722143000-1001
SN=ABC123
size=24576
CMD=uploadphoto
[BINARY IMAGE DATA - JPG format]
```

#### Réponse du serveur (succès) :
```
HTTP/1.1 200 OK
Content-Type: text/plain

OK
```

---

## 9. Contraintes Techniques

- L'application doit fonctionner **en ligne et hors ligne** pour le contrôle d'accès
- Les données de plannings d'accès doivent être **cachées localement** sur l'appareil ZKTeco
- La synchronisation doit être **automatique** dès le retour de la connexion
- Interface en **français**
- Tarifs et réductions **entièrement paramétrables** depuis l'interface
- Le serveur doit implémenter les endpoints PUSH SDK :
  - `GET /iclock/cdata` — Réception des données de l'appareil
  - `POST /iclock/cdata` — Réception des logs/photo
  - `GET /iclock/getrequest` — File d'attente des commandes
  - `POST /iclock/devicecmd` — Retour d'exécution des commandes
- Le serveur doit retourner des en-têtes HTTP standards avec `Date` pour la synchronisation horaire
- Les commandes mises en file d'attente ne doivent pas dépasser 200 commandes / 40 Ko
- Support du mode UDP pour accélérer la livraison des commandes (port 4374)
