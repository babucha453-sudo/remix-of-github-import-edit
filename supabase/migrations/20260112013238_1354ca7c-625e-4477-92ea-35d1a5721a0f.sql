-- Enable pgcrypto for secure token generation used by appointment management
CREATE EXTENSION IF NOT EXISTS pgcrypto;