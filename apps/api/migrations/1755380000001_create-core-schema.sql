-- Up Migration

CREATE TABLE providers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  name          text NOT NULL,
  role          text NOT NULL CHECK (role IN ('provider', 'admin')),
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE patients (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name  text NOT NULL,
  dob        date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (first_name, last_name, dob)
);

CREATE TABLE templates (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 text NOT NULL,
  encounter_type       text NOT NULL,
  prompt_instructions  text NOT NULL,
  is_active            boolean NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE encounters (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id  uuid NOT NULL REFERENCES providers(id),
  patient_id   uuid NOT NULL REFERENCES patients(id),
  template_id  uuid REFERENCES templates(id),
  status       text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'generated', 'saved')),
  transcript   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_encounters_provider_id ON encounters(provider_id);
CREATE INDEX idx_encounters_patient_id ON encounters(patient_id);

CREATE TABLE note_versions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id    uuid NOT NULL REFERENCES encounters(id),
  version_number  integer NOT NULL,
  subjective      text NOT NULL,
  objective       text NOT NULL,
  assessment      text NOT NULL,
  plan            text NOT NULL,
  icd10_codes     jsonb NOT NULL DEFAULT '[]',
  author_id       uuid NOT NULL REFERENCES providers(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (encounter_id, version_number)
);
CREATE INDEX idx_note_versions_encounter_id ON note_versions(encounter_id);

CREATE TABLE drafts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id  uuid NOT NULL UNIQUE REFERENCES encounters(id),
  provider_id   uuid NOT NULL REFERENCES providers(id),
  transcript    text,
  note_draft    jsonb,
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_drafts_provider_id ON drafts(provider_id);

CREATE TABLE audit_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    uuid REFERENCES providers(id),
  action      text NOT NULL,
  target_type text,
  target_id   uuid,
  metadata    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

CREATE TABLE icd10_codes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE,
  description text NOT NULL,
  embedding   vector(1024),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_icd10_codes_embedding ON icd10_codes USING hnsw (embedding vector_cosine_ops);

-- Down Migration

DROP TABLE IF EXISTS icd10_codes;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS drafts;
DROP TABLE IF EXISTS note_versions;
DROP TABLE IF EXISTS encounters;
DROP TABLE IF EXISTS templates;
DROP TABLE IF EXISTS patients;
DROP TABLE IF EXISTS providers;
