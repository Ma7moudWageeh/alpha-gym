export const CHANGELOG_DATA = [
  {
    version: "1.0.13",
    releaseDate: "September 2026",
    title: "Full Backup Archive, Auto-Snapshots & Financial Void Engine",
    categories: [
      {
        name: "Data Safety & Backups",
        items: [
          "Consolidated backup archive: Bundles SQLite database, all athlete profile photos, and WhatsApp messaging preferences into a single .zip file.",
          "Automated daily rolling snapshots: Silently retains the last 7 daily backups with automatic pruning.",
          "Protected restore pipeline: Automatically captures a pre-restore emergency copy and validates database integrity before restoring."
        ]
      },
      {
        name: "Financial Management",
        items: [
          "Direct subscription voiding: Delete erroneous subscriptions directly from the client profile with automatic revenue rollback.",
          "Selective athlete deletion: Choose whether to purge or preserve financial records when deleting a member profile.",
          "Real-time revenue synchronization: Voided payments immediately deduct from Today's Revenue and financial reports."
        ]
      },
      {
        name: "UI & Stability",
        items: [
          "Enhanced Settings page with backup progress indicators, archive sizes, and safety notices.",
          "Optimized memory and database connection handling during automated snapshots."
        ]
      }
    ]
  },
  {
    version: "1.0.12",
    releaseDate: "September 2026",
    title: "Database Migration & Roster Connectivity Patch",
    categories: [
      {
        name: "Critical Fixes",
        items: [
          "Fixed client directory data sync to restore immediate visibility of all 96+ athletes.",
          "Automatic database schema migration for seamless compatibility with older database versions.",
          "Synchronized frozen member counts and status indicators between Dashboard and Clients pages."
        ]
      }
    ]
  },
  {
    version: "1.0.11",
    releaseDate: "September 2026",
    title: "Frozen Memberships Sync & Dashboard Alignment",
    categories: [
      {
        name: "Membership Synchronization",
        items: [
          "Dual-table atomic synchronization between subscriptions and clients on freeze and unfreeze.",
          "Perfect count alignment between Dashboard and Clients roster for Active and Frozen members.",
          "Client roster query enriched with real-time subscription status and frozen flags."
        ]
      },
      {
        name: "UI & Visual Identity",
        items: [
          "Ice-blue visual theme for frozen members: ❄️ FROZEN animated badge and cyan avatar glow.",
          "Electric cyan UNFREEZE MEMBERSHIP action button in member profile.",
          "Updated Frozen KPI card on Clients screen with clean cyan accents."
        ]
      },
      {
        name: "Navigation & Workflow",
        items: [
          "Dashboard KPI cards deep-linking: clicking Active or Frozen immediately filters the Clients roster.",
          "Automatic real-time roster refresh upon freezing or unfreezing subscriptions."
        ]
      }
    ]
  },
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
