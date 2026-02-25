CREATE OR REPLACE FUNCTION delete_user_link_tokens_after_identity_delete()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM account_link_tokens
  WHERE user_id = OLD.user_id;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS identities_delete_user_link_tokens_after_delete ON identities;

CREATE TRIGGER identities_delete_user_link_tokens_after_delete
AFTER DELETE ON identities
FOR EACH ROW
EXECUTE FUNCTION delete_user_link_tokens_after_identity_delete();
