UPDATE statcan_product_schedules SET
  frequency = 'weekly',
  day_of_week = CAST(strftime('%w', 'now') AS INTEGER),
  hour_utc = CAST(strftime('%H', 'now') AS INTEGER),
  minute_utc = CAST(strftime('%M', 'now') AS INTEGER),
  day_of_month = NULL,
  next_run_at = '2000-01-01T00:00:00.000Z',
  updated_at = datetime('now')
WHERE product_id IN (34100096, 34100099, 34100100, 36100350, 10100106);
