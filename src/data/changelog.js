export const CHANGELOG_DATA = [
  {
    version: "1.0.10",
    releaseDate: "September 2026",
    title: "Financial Dues & Member Management Update",
    categories: [
      {
        name: "Financial & Debt Tracking",
        items: [
          "Added partial payment option during registration and renewal.",
          "New 'With Debt' tab to quickly track members with unpaid balances.",
          "Direct balance settlement from client profile with automatic receipt updates.",
          "Remaining balance clearly itemized on printed receipts."
        ]
      },
      {
        name: "Roster & Status Organization",
        items: [
          "The 'Expired' tab now neatly places the most recent expirations at the top.",
          "Strict 30-day retention threshold preserved before overdue members transition to inactive.",
          "Refined member status badges for immediate clarity (Active, Expired, With Debt)."
        ]
      },
      {
        name: "General Improvements",
        items: [
          "What's New changelog dialog displayed upon first launch post-update.",
          "Normalized database status constraints and date calculations for absolute stability."
        ]
      }
    ]
  }
];
