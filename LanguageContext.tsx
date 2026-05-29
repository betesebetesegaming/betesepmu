
import React, { createContext, useState, useContext, useEffect } from 'react';

type Language = 'en' | 'fr';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    // General
    "app_name": "Betese PMU",
    "welcome": "Welcome",
    "loading": "Loading...",
    "close": "Close",
    "cancel": "Cancel",
    "confirm": "Confirm",
    "save": "Save",
    "delete": "Delete",
    "edit": "Edit",
    "back": "Back",
    
    // Login / Signup
    "login_title": "System Login",
    "create_account": "Create Account",
    "join_message": "Join Betese to start playing online.",
    "full_name": "Full Name",
    "phone_number": "Phone Number",
    "password": "Password",
    "confirm_password": "Confirm Password",
    "open_account": "Open Account",
    "already_have_account": "Already have an account? Sign In",
    "sign_in": "Sign in",
    "dont_have_account": "Don't have an account?",
    "create_customer_account": "Create a Customer Account",
    "official_rules_link": "Official Betting Rules & Regulations",
    "agree_terms": "By clicking Open Account, you agree to the",
    "must_be_18": "You must be 18+ to play.",
    
    // Dashboard Tabs
    "tab_place_bet": "Place Bet",
    "tab_history": "Bet History",
    "tab_wallet": "My Wallet",
    "tab_info": "Info & Prices",
    
    // Betting
    "select_race": "1. Select a Race",
    "select_bet_type": "2. Select Bet Type",
    "no_races": "There are no races scheduled for betting.",
    "add_to_slip": "Add to Bet Slip",
    "place_bet": "Place Bet",
    "book_bet": "Book Bet (Pay at Shop)",
    "booking_notice": "Booking does not require online credit",
    "total_cost": "Total Cost",
    "clear_all": "Clear All",
    "bet_slip": "Bet Slip",
    "your_bet_slip_empty": "Your bet slip is empty.",
    
    // Wallet
    "available_balance": "Available Balance (Withdrawable)",
    "bonus_money": "Bonus Money (For Betting)",
    "deposit_funds": "Deposit Funds",
    "withdraw_funds": "Withdraw Funds",
    "how_to_deposit": "How to Deposit with Wave:",
    "deposit_step_1": "Enter the amount, then continue to the Wave checkout page.",
    "deposit_step_2": "On desktop, scan the QR code. On phone, Wave may open directly.",
    "deposit_step_3": "Complete the payment, then enter the sender phone number and submit.",
    "amount_sent": "Amount Sent",
    "payment_method": "Payment Method",
    "sender_phone": "Sender Phone Number (Paid From)",
    "submit_deposit": "Submit Deposit Request",
    "deposit_history": "Deposit History",
    "amount_to_withdraw": "Amount to Withdraw",
    "generate_code": "Generate Withdrawal Code",
    "withdrawal_history": "Withdrawal History",
    "change_password": "Change Password",
    "current_password": "Current Password",
    "new_password": "New Password",
    "update_password": "Update Password",
    
    // Info
    "daily_program": "Daily Program",
    "view_programs": "View Programs",
    "legal_compliance": "Legal & Compliance",
    "official_payouts": "Official Payouts",
    
    // Messages
    "success_deposit": "Deposit request submitted successfully! Waiting for approval.",
    "error_fill_fields": "Please fill all fields.",
  },
  fr: {
    // General
    "app_name": "Betese PMU",
    "welcome": "Bienvenue",
    "loading": "Chargement...",
    "close": "Fermer",
    "cancel": "Annuler",
    "confirm": "Confirmer",
    "save": "Enregistrer",
    "delete": "Supprimer",
    "edit": "Modifier",
    "back": "Retour",
    
    // Login / Signup
    "login_title": "Connexion Système",
    "create_account": "Créer un Compte",
    "join_message": "Rejoignez Betese pour jouer en ligne.",
    "full_name": "Nom Complet",
    "phone_number": "Numéro de Téléphone",
    "password": "Mot de passe",
    "confirm_password": "Confirmer le mot de passe",
    "open_account": "Ouvrir un Compte",
    "already_have_account": "Vous avez déjà un compte ? Connectez-vous",
    "sign_in": "Se connecter",
    "dont_have_account": "Vous n'avez pas de compte ?",
    "create_customer_account": "Créer un compte client",
    "official_rules_link": "Règlement Officiel des Paris",
    "agree_terms": "En cliquant sur Ouvrir un compte, vous acceptez le",
    "must_be_18": "Vous devez avoir 18+ ans pour jouer.",
    
    // Dashboard Tabs
    "tab_place_bet": "Parier",
    "tab_history": "Historique",
    "tab_wallet": "Portefeuille",
    "tab_info": "Infos & Prix",
    
    // Betting
    "select_race": "1. Choisissez une Course",
    "select_bet_type": "2. Choisissez le Pari",
    "no_races": "Il n'y a pas de courses programmées.",
    "add_to_slip": "Ajouter au Panier",
    "place_bet": "Valider le Pari",
    "book_bet": "Réserver (Payer au Guichet)",
    "booking_notice": "La réservation ne nécessite pas de crédit",
    "total_cost": "Coût Total",
    "clear_all": "Tout Effacer",
    "bet_slip": "Panier",
    "your_bet_slip_empty": "Votre panier est vide.",
    
    // Wallet
    "available_balance": "Solde Disponible (Retirable)",
    "bonus_money": "Argent Bonus (Pour Parier)",
    "deposit_funds": "Dépôt",
    "withdraw_funds": "Retrait",
    "how_to_deposit": "Comment déposer avec Wave :",
    "deposit_step_1": "Entrez le montant, puis ouvrez la page de paiement Wave.",
    "deposit_step_2": "Sur ordinateur, scannez le code QR. Sur téléphone, Wave peut s'ouvrir directement.",
    "deposit_step_3": "Terminez le paiement, puis saisissez le numéro de l'expéditeur et envoyez.",
    "amount_sent": "Montant Envoyé",
    "payment_method": "Moyen de Paiement",
    "sender_phone": "Numéro Expéditeur",
    "submit_deposit": "Envoyer Demande de Dépôt",
    "deposit_history": "Historique des Dépôts",
    "amount_to_withdraw": "Montant à Retirer",
    "generate_code": "Générer Code de Retrait",
    "withdrawal_history": "Historique des Retraits",
    "change_password": "Changer Mot de Passe",
    "current_password": "Mot de passe actuel",
    "new_password": "Nouveau mot de passe",
    "update_password": "Mettre à jour",
    
    // Info
    "daily_program": "Programme du Jour",
    "view_programs": "Voir Programmes",
    "legal_compliance": "Juridique & Conformité",
    "official_payouts": "Rapports Officiels",
    
    // Messages
    "success_deposit": "Demande de dépôt envoyée ! En attente de validation.",
    "error_fill_fields": "Veuillez remplir tous les champs.",
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('en');

  // Load saved language preference on mount
  useEffect(() => {
    try {
      const savedLang = localStorage.getItem('betese-language') as Language;
      if (savedLang && (savedLang === 'en' || savedLang === 'fr')) {
        setLanguage(savedLang);
      }
    } catch { /* storage blocked in private/restricted mode */ }
  }, []);

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang);
    try { localStorage.setItem('betese-language', lang); } catch { /* ignore */ }
  };

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
