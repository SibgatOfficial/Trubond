/**
 * One selectable branch/department. `value` is the stable code stored on the
 * profile (and used as the branch-chat room id / Firestore filter key),
 * `label` is what humans read.
 */
export interface BranchOption {
  value: string;
  label: string;
}

export interface BranchGroup {
  label: string;
  options: BranchOption[];
}

/**
 * Branches grouped by faculty so ~80 options stay navigable.
 *
 * `value` doubles as the branch-chat room id and the Firestore filter key
 * (`where("branch", "==", ...)`), so codes must be short, unique and STABLE —
 * never rename one once shipped. The six original engineering codes
 * (CSE, CSD, ECE, EEE, MECH, CIVIL) must stay as-is for existing profiles.
 */
export const BRANCH_GROUPS: BranchGroup[] = [
  {
    label: "Engineering & Technology",
    options: [
      { value: "CSE", label: "Computer Science & Engineering" },
      { value: "CSD", label: "Computer Science & Design" },
      { value: "IT", label: "Information Technology" },
      { value: "AIML", label: "Artificial Intelligence & Machine Learning" },
      { value: "DS", label: "Data Science & Analytics" },
      { value: "CYBER", label: "Cyber Security" },
      { value: "IOT", label: "Internet of Things" },
      { value: "ECE", label: "Electronics & Communication" },
      { value: "EEE", label: "Electrical & Electronics" },
      { value: "EIE", label: "Electronics & Instrumentation" },
      { value: "MECH", label: "Mechanical Engineering" },
      { value: "CIVIL", label: "Civil Engineering" },
      { value: "CHEMENG", label: "Chemical Engineering" },
      { value: "AERO", label: "Aerospace Engineering" },
      { value: "AUTO", label: "Automobile Engineering" },
      { value: "BIOTECH", label: "Biotechnology" },
      { value: "ENV", label: "Environmental Engineering" },
      { value: "MIN", label: "Mining Engineering" },
      { value: "TEXT", label: "Textile Engineering" },
      { value: "PROD", label: "Production & Industrial Engineering" },
    ],
  },
  {
    label: "Medical & Health Sciences",
    options: [
      { value: "MBBS", label: "Medicine & Surgery (MBBS)" },
      { value: "BDS", label: "Dentistry (BDS)" },
      { value: "BAMS", label: "Ayurvedic Medicine (BAMS)" },
      { value: "BHMS", label: "Homeopathic Medicine (BHMS)" },
      { value: "BNYS", label: "Naturopathy & Yoga Sciences" },
      { value: "NURSING", label: "Nursing" },
      { value: "PHARM", label: "Pharmacy" },
      { value: "PHYSIO", label: "Physiotherapy" },
      { value: "OPTOM", label: "Optometry" },
      { value: "MLT", label: "Medical Laboratory Technology" },
      { value: "PA", label: "Physician Assistant" },
      { value: "PUBHLTH", label: "Public Health" },
      { value: "NUTR", label: "Nutrition & Dietetics" },
      { value: "OCCUP", label: "Occupational Therapy" },
      { value: "SPEECH", label: "Speech & Hearing" },
    ],
  },
  {
    label: "Science",
    options: [
      { value: "PHY", label: "Physics" },
      { value: "CHM", label: "Chemistry" },
      { value: "MATH", label: "Mathematics" },
      { value: "STAT", label: "Statistics" },
      { value: "ZOO", label: "Zoology" },
      { value: "BOT", label: "Botany" },
      { value: "BIOL", label: "Biological Sciences" },
      { value: "MICRO", label: "Microbiology" },
      { value: "GEO", label: "Geography" },
      { value: "GEOL", label: "Geology" },
      { value: "ASTRO", label: "Astronomy & Space Sciences" },
    ],
  },
  {
    label: "Commerce & Management",
    options: [
      { value: "COMMERCE", label: "Commerce & Accounting" },
      { value: "BBA", label: "Business Administration" },
      { value: "FINANCE", label: "Finance & Banking" },
      { value: "ECON", label: "Economics" },
      { value: "HOTEL", label: "Hotel & Hospitality Management" },
      { value: "TOURISM", label: "Travel & Tourism" },
      { value: "MARKETING", label: "Marketing" },
      { value: "ENTREP", label: "Entrepreneurship" },
    ],
  },
  {
    label: "Law",
    options: [
      { value: "LAW", label: "Law (LL.B / BA LL.B)" },
      { value: "LEGAL", label: "Legal Studies" },
      { value: "POLSCI", label: "Political Science" },
      { value: "INTLREL", label: "International Relations" },
    ],
  },
  {
    label: "Humanities & Social Sciences",
    options: [
      { value: "PSY", label: "Psychology" },
      { value: "SOC", label: "Sociology" },
      { value: "HIST", label: "History" },
      { value: "ENG", label: "English & Literature" },
      { value: "PHIL", label: "Philosophy" },
      { value: "ANTHRO", label: "Anthropology" },
      { value: "SOCWORK", label: "Social Work" },
      { value: "LANGS", label: "Languages & Linguistics" },
      { value: "MEDIA", label: "Media & Communication" },
      { value: "PUBADMIN", label: "Public Administration" },
    ],
  },
  {
    label: "Design, Architecture & Arts",
    options: [
      { value: "DESIGN", label: "Design (B.Des)" },
      { value: "ARCH", label: "Architecture (B.Arch)" },
      { value: "FASHION", label: "Fashion Design" },
      { value: "FINEART", label: "Fine Arts" },
      { value: "MULTIMEDIA", label: "Multimedia & Animation" },
      { value: "INTERIOR", label: "Interior Design" },
      { value: "PERFORM", label: "Performing Arts" },
      { value: "PHOTO", label: "Photography" },
    ],
  },
  {
    label: "Education",
    options: [
      { value: "BED", label: "Teaching & Education (B.Ed)" },
      { value: "SPED", label: "Special Education" },
      { value: "PHYSICALED", label: "Physical Education" },
    ],
  },
  {
    label: "Agriculture & Veterinary",
    options: [
      { value: "AGRI", label: "Agriculture" },
      { value: "HORT", label: "Horticulture" },
      { value: "VET", label: "Veterinary Sciences" },
      { value: "FISHERY", label: "Fisheries Science" },
      { value: "FORESTRY", label: "Forestry" },
      { value: "DAIRY", label: "Dairy Technology" },
    ],
  },
];

/** Flat list — simple dropdowns (notes filters, note editors) map over this. */
export const BRANCHES: BranchOption[] = BRANCH_GROUPS.flatMap(
  (group) => group.options
);

/** Curated degree groups — global degrees, grouped by level. */
export const DEGREE_GROUPS: { label: string; degrees: string[] }[] = [
  {
    label: "Bachelor's",
    degrees: [
      "B.Tech",
      "B.E.",
      "B.Sc",
      "BCA",
      "BBA",
      "B.Com",
      "BA",
      "LL.B.",
      "B.Pharm",
      "BPT",
      "B.Sc Nursing",
      "MBBS",
      "BDS",
      "BAMS",
      "BHMS",
      "B.Arch",
      "B.Des",
      "B.Ed",
      "BHM",
      "BJMC",
    ],
  },
  {
    label: "Master's",
    degrees: [
      "M.Tech",
      "M.E.",
      "M.Sc",
      "MCA",
      "MBA",
      "M.Com",
      "MA",
      "LL.M.",
      "M.Pharm",
      "MD",
      "MS",
      "M.Arch",
      "M.Des",
      "M.Ed",
      "MPH",
      "MJMC",
    ],
  },
  {
    label: "Doctoral & Diploma",
    degrees: [
      "Ph.D.",
      "D.Phil.",
      "M.Phil.",
      "Diploma",
      "Post Graduate Diploma",
      "Certificate Course",
      "Associate Degree",
    ],
  },
];

/** Flat degree list — used to detect whether a stored degree is one of ours. */
export const DEGREES: string[] = DEGREE_GROUPS.flatMap((group) => group.degrees);

/**
 * Sentinel degree option that reveals a free-text input. The typed text is
 * what gets stored — this label itself is never saved.
 */
export const DEGREE_OTHER = "Other";

export const GENDERS = ["Male", "Female", "Other", "Prefer not to say"] as const;

export const NAV_ITEMS = [
  { href: "/home", label: "Home", icon: "home" },
  { href: "/notes", label: "Notes", icon: "notes" },
  { href: "/chat", label: "Chat", icon: "chat" },

  { href: "/events", label: "Events", icon: "event" },
  { href: "/projects", label: "Projects", icon: "folder" },
  { href: "/profile", label: "Profile", icon: "account_circle" },
] as const;

/** Semester options shared by note creation and filtering. */
export const SEMESTERS = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th"] as const;

export type NoteSortOption = "recent" | "top" | "downloads";

export const APP_NAME = "Trubond";
export const APP_TAGLINE = "College Networking App";
