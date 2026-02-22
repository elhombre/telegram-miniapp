-- CreateTable
CREATE TABLE notes (
    id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) NOT NULL,

    CONSTRAINT notes_pkey PRIMARY KEY (id)
);

-- CreateIndex
CREATE INDEX notes_user_id_created_at_idx ON notes(user_id, created_at DESC);

-- AddForeignKey
ALTER TABLE notes ADD CONSTRAINT notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;
