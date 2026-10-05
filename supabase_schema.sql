-- =========================================================================
-- ROAST YOUR WORKSPACE — DATABASE SCHEMA & ROW LEVEL SECURITY (RLS)
-- Multi-Tenant Room Isolation, Ephemeral Feeds & Interactive Banter
-- Compatible with PostgreSQL 14+ / Supabase
-- =========================================================================

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -------------------------------------------------------------
-- 1. ORGANIZATIONS (Private Workspace Rooms)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organizations (
    id VARCHAR(64) PRIMARY KEY,
    code VARCHAR(32) UNIQUE NOT NULL,             -- e.g. 'SWIGGY-101', 'ZOMATO-202'
    name VARCHAR(128) NOT NULL,                    -- e.g. 'Swiggy Tech Arena'
    domain VARCHAR(128) UNIQUE NOT NULL,          -- e.g. 'swiggy.in'
    tagline TEXT DEFAULT 'Isolated Workspace Banter Arena',
    accent_color VARCHAR(16) DEFAULT '#FF5722',
    member_count INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for instant room lookup by code or domain
CREATE INDEX IF NOT EXISTS idx_org_code ON organizations(code);
CREATE INDEX IF NOT EXISTS idx_org_domain ON organizations(domain);

-- -------------------------------------------------------------
-- 2. USERS / DESK CLAIMS
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    emp_id VARCHAR(64),                           -- Employee ID e.g. 'SW-8891'
    email VARCHAR(128),                           -- Work Email e.g. 'rohan@swiggy.in'
    alias VARCHAR(128) NOT NULL,                  -- Anonymous Alias e.g. 'Panchayat Banrakas'
    role VARCHAR(64) DEFAULT 'Team Member',
    karma INT DEFAULT 100,
    streak INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_org ON users(org_id);

-- -------------------------------------------------------------
-- 3. COLLEAGUES DIRECTORY (Target Board Roster)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS colleagues (
    id VARCHAR(64) PRIMARY KEY,
    org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(128) NOT NULL,
    handle VARCHAR(64) NOT NULL,
    department VARCHAR(64) NOT NULL,
    designation VARCHAR(128) NOT NULL,
    avatar VARCHAR(16) DEFAULT '👓',
    quirk TEXT,
    status_note TEXT,
    roast_count INT DEFAULT 0,
    karma INT DEFAULT 1000,
    streak INT DEFAULT 5,
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_colleagues_org ON colleagues(org_id);

-- -------------------------------------------------------------
-- 4. POSTS & ROASTS (Mandatory Schema Specification)
-- Fields: id, org_id, author_alias, target_user_id, meme_template_id, 
--         top_text, bottom_text, karma_points, spiciness_level, created_at
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS posts (
    id VARCHAR(64) PRIMARY KEY,
    org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    author_alias VARCHAR(128) NOT NULL,           -- Masked Incognito Name
    target_user_id VARCHAR(64),                   -- Referenced Colleague Target
    target_user_name VARCHAR(128),
    meme_template_id VARCHAR(64),                 -- Meme Template Reference (e.g. 'meme_circuit')
    top_text TEXT,                                -- Punchline Top
    bottom_text TEXT,                             -- Punchline Bottom
    karma_points INT DEFAULT 15,
    spiciness_level VARCHAR(32) DEFAULT 'bold',   -- 'mild', 'medium', 'bold', 'nuclear'
    roast_subject VARCHAR(256) DEFAULT 'Workplace Banter',
    content TEXT,                                 -- Narrative roast body
    tags TEXT[] DEFAULT ARRAY['WorkplaceRoast'],
    reactions JSONB DEFAULT '{"roasts": 1, "masala": 0, "chai": 0, "salty": 0}'::jsonb,
    report_count INT DEFAULT 0,
    comments JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_posts_org ON posts(org_id);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_target ON posts(target_user_id);

-- -------------------------------------------------------------
-- 5. CHAI-SUTTA WHISPERS (Ephemeral Feed with 2-Hour Auto-TTL)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS whispers (
    id VARCHAR(64) PRIMARY KEY,
    org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    author_alias VARCHAR(128) NOT NULL,
    text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '2 hours')  -- 2-Hour TTL
);

CREATE INDEX IF NOT EXISTS idx_whispers_org ON whispers(org_id);
CREATE INDEX IF NOT EXISTS idx_whispers_expires ON whispers(expires_at);

-- -------------------------------------------------------------
-- 6. POLLS & LEADERBOARDS (Chai Tapri Polls)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS polls (
    id VARCHAR(64) PRIMARY KEY,
    org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    options JSONB NOT NULL,                       -- [{ id, text, votes }]
    total_votes INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS poll_votes (
    id VARCHAR(64) PRIMARY KEY,
    org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    poll_id VARCHAR(64) NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    option_id VARCHAR(64) NOT NULL,
    user_identifier VARCHAR(128) NOT NULL,        -- Masked user hash or alias
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_vote UNIQUE (poll_id, user_identifier)
);

CREATE INDEX IF NOT EXISTS idx_polls_org ON polls(org_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_poll ON poll_votes(poll_id);

-- -------------------------------------------------------------
-- 7. MEME TEMPLATES (Desi Khazana Repository & Custom Uploads)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meme_templates (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(128) NOT NULL,
    universe VARCHAR(64) NOT NULL,                -- Panchayat, TMKOC, Hera Pheri, Shark Tank, 90s Cartoons, Bollywood, Custom
    character VARCHAR(64),
    image_url TEXT NOT NULL,
    default_top TEXT,
    default_bottom TEXT,
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_by_user BOOLEAN DEFAULT FALSE,        -- True if user-created custom template
    created_by VARCHAR(128),                      -- Author alias or user ID
    org_id VARCHAR(64) REFERENCES organizations(id) ON DELETE SET NULL, -- Scoped to org or global if null
    uses VARCHAR(32) DEFAULT '1.2k',
    badge VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meme_templates_universe ON meme_templates(universe);
CREATE INDEX IF NOT EXISTS idx_meme_templates_user ON meme_templates(created_by_user);
CREATE INDEX IF NOT EXISTS idx_meme_templates_org ON meme_templates(org_id);

-- -------------------------------------------------------------
-- 8. SAVED MEMES (User Bookmark Khazana)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS saved_memes (
    id VARCHAR(64) PRIMARY KEY,
    user_alias VARCHAR(128) NOT NULL,             -- Saved by user alias
    org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    meme_template_id VARCHAR(64),                 -- Originating meme template ID if any
    post_id VARCHAR(64),                          -- Originating feed post ID if saved from Live Feed
    title VARCHAR(128) NOT NULL,
    image_url TEXT NOT NULL,
    top_text TEXT,
    bottom_text TEXT,
    universe VARCHAR(64) DEFAULT 'Saved',
    tags TEXT[] DEFAULT ARRAY['SavedMemes']::TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_memes_user ON saved_memes(user_alias, org_id);

-- =========================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Enforces strict room isolation across all tenant-scoped tables
-- =========================================================================

-- Enable RLS across all tenant-partitioned tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE colleagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE whispers ENABLE ROW LEVEL SECURITY;
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE meme_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_memes ENABLE ROW LEVEL SECURITY;

-- 1. Organizations: Users can view their active organization
CREATE POLICY org_select_policy ON organizations
    FOR SELECT
    USING (
        id = NULLIF(current_setting('app.current_org_id', true), '')
        OR id = (SELECT auth.jwt() ->> 'org_id')
        OR true -- Allows domain/code lookup during initial join screen
    );

-- 2. Posts: Strict room isolation guard (Read & Write)
CREATE POLICY posts_tenant_isolation_select ON posts
    FOR SELECT
    USING (
        org_id = NULLIF(current_setting('app.current_org_id', true), '')
        OR org_id = (SELECT auth.jwt() ->> 'org_id')
    );

CREATE POLICY posts_tenant_isolation_insert ON posts
    FOR INSERT
    WITH CHECK (
        org_id = NULLIF(current_setting('app.current_org_id', true), '')
        OR org_id = (SELECT auth.jwt() ->> 'org_id')
    );

CREATE POLICY posts_tenant_isolation_update ON posts
    FOR UPDATE
    USING (
        org_id = NULLIF(current_setting('app.current_org_id', true), '')
        OR org_id = (SELECT auth.jwt() ->> 'org_id')
    );

-- 3. Whispers: Ephemeral 2-Hour TTL + Tenant Isolation
CREATE POLICY whispers_tenant_isolation_select ON whispers
    FOR SELECT
    USING (
        (org_id = NULLIF(current_setting('app.current_org_id', true), '')
         OR org_id = (SELECT auth.jwt() ->> 'org_id'))
        AND expires_at > NOW() -- Exclude expired whispers automatically
    );

CREATE POLICY whispers_tenant_isolation_insert ON whispers
    FOR INSERT
    WITH CHECK (
        org_id = NULLIF(current_setting('app.current_org_id', true), '')
        OR org_id = (SELECT auth.jwt() ->> 'org_id')
    );

-- 4. Polls & Votes: Tenant Isolation
CREATE POLICY polls_tenant_isolation_select ON polls
    FOR SELECT
    USING (
        org_id = NULLIF(current_setting('app.current_org_id', true), '')
        OR org_id = (SELECT auth.jwt() ->> 'org_id')
    );

CREATE POLICY poll_votes_tenant_isolation ON poll_votes
    FOR ALL
    USING (
        org_id = NULLIF(current_setting('app.current_org_id', true), '')
        OR org_id = (SELECT auth.jwt() ->> 'org_id')
    );

-- 5. Meme Templates: View global curated templates OR templates created by own org
CREATE POLICY meme_templates_select ON meme_templates
    FOR SELECT
    USING (
        org_id IS NULL -- Global templates available to all
        OR org_id = NULLIF(current_setting('app.current_org_id', true), '')
        OR org_id = (SELECT auth.jwt() ->> 'org_id')
    );

CREATE POLICY meme_templates_insert ON meme_templates
    FOR INSERT
    WITH CHECK (
        org_id = NULLIF(current_setting('app.current_org_id', true), '')
        OR org_id = (SELECT auth.jwt() ->> 'org_id')
    );

-- 6. Saved Memes: Scoped to user and their active workspace
CREATE POLICY saved_memes_tenant_isolation ON saved_memes
    FOR ALL
    USING (
        org_id = NULLIF(current_setting('app.current_org_id', true), '')
        OR org_id = (SELECT auth.jwt() ->> 'org_id')
    );

-- =========================================================================
-- AUTO-CLEANUP ROUTINE FOR EPHEMERAL WHISPERS (2-Hour TTL Purge)
-- =========================================================================
CREATE OR REPLACE FUNCTION purge_expired_whispers()
RETURNS void AS $$
BEGIN
    DELETE FROM whispers WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
