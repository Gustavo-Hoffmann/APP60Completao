-- Participantes: nacionalidade + documento de identidade (CPF obrigatório apenas para BR).
-- Remove unicidade global do documento; mantém unicidade apenas quando nacionalidade = BR.

ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS nationality char(2) NOT NULL DEFAULT 'BR';

ALTER TABLE participants
  ALTER COLUMN cpf_normalized TYPE varchar(80);

ALTER TABLE participants
  ALTER COLUMN cpf_normalized DROP NOT NULL;

UPDATE participants SET nationality = 'BR' WHERE nationality IS NULL;

ALTER TABLE participants
  DROP CONSTRAINT IF EXISTS participants_cpf_normalized_key;

CREATE UNIQUE INDEX IF NOT EXISTS participants_br_cpf_unique
  ON participants (cpf_normalized)
  WHERE nationality = 'BR';
