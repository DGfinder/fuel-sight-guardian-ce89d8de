-- Get customer contacts for testing
SELECT
  id,
  customer_name,
  contact_name,
  contact_email,
  report_frequency,
  enabled,
  last_email_sent_at
FROM customer_contacts
WHERE enabled = true
ORDER BY last_email_sent_at DESC NULLS LAST
LIMIT 5;
