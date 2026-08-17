import "reflect-metadata";
import "../config/load-dotenv";
import { Pool } from "pg";
import * as argon2 from "argon2";
import { buildAppConfig } from "../config/app-config";

const PROVIDERS = [
  { email: "dr.chen@clinic.dev", name: "Dr. Amy Chen", password: "provider-pass-1" },
  { email: "dr.patel@clinic.dev", name: "Dr. Raj Patel", password: "provider-pass-2" },
  { email: "dr.osei@clinic.dev", name: "Dr. Kwame Osei", password: "provider-pass-3" },
];
const ADMIN = { email: "admin@clinic.dev", name: "Clinic Admin", password: "admin-pass-1" };

const TEMPLATES = [
  {
    name: "Ortho Follow-up",
    encounterType: "orthopedic_follow_up",
    promptInstructions:
      "Emphasize range-of-motion, pain scale trend since last visit, and functional status. Keep Plan focused on physical therapy / imaging / injection follow-up.",
  },
  {
    name: "New Patient Evaluation",
    encounterType: "new_patient_eval",
    promptInstructions:
      "Include a full past medical history summary in Subjective and a complete review-of-systems style Objective. Plan should include baseline labs/imaging as appropriate.",
  },
  {
    name: "Urgent Care Visit",
    encounterType: "urgent_care",
    promptInstructions:
      "Be concise. Subjective and Objective should focus only on the presenting complaint. Plan should prioritize immediate management and clear return-precautions.",
  },
];

async function main() {
  const config = await buildAppConfig();
  const pool = new Pool({ connectionString: config.databaseUrl });

  for (const p of PROVIDERS) {
    const hash = await argon2.hash(p.password);
    await pool.query(
      `INSERT INTO providers (email, password_hash, name, role) VALUES ($1, $2, $3, 'provider')
       ON CONFLICT (email) DO NOTHING`,
      [p.email, hash, p.name],
    );
  }

  const adminHash = await argon2.hash(ADMIN.password);
  await pool.query(
    `INSERT INTO providers (email, password_hash, name, role) VALUES ($1, $2, $3, 'admin')
     ON CONFLICT (email) DO NOTHING`,
    [ADMIN.email, adminHash, ADMIN.name],
  );

  for (const t of TEMPLATES) {
    const existing = await pool.query("SELECT id FROM templates WHERE name = $1", [t.name]);
    if (existing.rows.length === 0) {
      await pool.query(
        `INSERT INTO templates (name, encounter_type, prompt_instructions) VALUES ($1, $2, $3)`,
        [t.name, t.encounterType, t.promptInstructions],
      );
    }
  }

  console.log(`Seeded ${PROVIDERS.length} providers, 1 admin, ${TEMPLATES.length} templates.`);
  console.log("Demo credentials (local dev only):");
  for (const p of PROVIDERS) console.log(`  provider: ${p.email} / ${p.password}`);
  console.log(`  admin:    ${ADMIN.email} / ${ADMIN.password}`);

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
