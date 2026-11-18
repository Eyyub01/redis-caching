CREATE TABLE orders (
  product_id SMALLINT NOT NULL,
  quantity SMALLINT NOT NULL
);

INSERT INTO orders (product_id, quantity)
SELECT
  CASE
    WHEN random() < 0.3 THEN (1 + floor(random() * 3))::smallint
    ELSE (1 + floor(random() * 20))::smallint
  END,
  (1 + floor(random() * 5))::smallint
FROM generate_series(1, 10000000);

-- 10M rows, narrow table (~330 MB volume). No index on product_id on purpose.