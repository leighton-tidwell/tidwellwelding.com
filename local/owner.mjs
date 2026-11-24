// The seeded owner account on the LOCAL stack only (local/seed.mjs creates it).
export const OWNER = {
  email: "owner@tidwellwelding.test",
  password: "local-only-password",
};

// One account per other role, all with the owner's password (LOCAL only).
// The employee reports to the manager, so team scoping has a tree to walk.
export const STAFF = [
  {
    email: "developer@tidwellwelding.test",
    name: "Dev Account",
    role: "developer",
    title: "Developer",
  },
  {
    email: "hr@tidwellwelding.test",
    name: "Hana Reyes",
    role: "hr",
    title: "Office manager",
  },
  {
    email: "manager@tidwellwelding.test",
    name: "Mark Lowry",
    role: "manager",
    title: "Crew lead",
  },
  {
    email: "employee@tidwellwelding.test",
    name: "Eli Park",
    role: "employee",
    title: "Welder",
    supervisor: "manager@tidwellwelding.test",
  },
];
