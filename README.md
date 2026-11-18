**Repository:** [github.com/Eyyub01/redis-caching](https://github.com/Eyyub01/redis-caching)

## Prerequisites

- Node 20 or newer
- Docker (images used: `postgres:18`, `redis:8`)

Optional before class (warmer pulls):

```bash
docker pull postgres:18
docker pull redis:8
```

## Quick start

```bash
git clone https://github.com/Eyyub01/redis-caching.git
cd redis-caching
cp .env.example .env
docker compose up -d
npm install
npm run start:dev
```

The first `docker compose up` loads **10 million** narrow order rows into PostgreSQL (about **330 MB** on disk after seeding). That usually takes **10 to 20 seconds**. Watch the container logs; when it is quiet, run:

```bash
docker compose exec postgres psql -U app -d shop -c "SELECT count(*) FROM orders;"
```

You should see `10000000` before starting the app.

Open http://localhost:3000 and reload the page a few times.
Each load takes about **1 to 2 seconds** while the server runs an unindexed `GROUP BY` over all orders (on a typical laptop; faster disks can be closer to one second).

## Try it with curl

```bash
curl -i http://localhost:3000/products
curl http://localhost:3000/products/top
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{"productId": 1, "quantity": 2}'
curl -X POST http://localhost:3000/products/1/view
```

## Reset the database

```bash
docker compose down -v
docker compose up -d
```

Then wait for the seed to finish before starting the app again.

If you already ran an older version of this demo (fewer rows or a wider `orders` table), **reset the volume** the same way so PostgreSQL re-runs `db/init.sql` and loads 10 million rows.

## Branches

- `main`: PostgreSQL works, no Redis. Start here.

```bash
git checkout solution
npm install
npm run start:dev
```

On the solution branch, the first page load is slow; the next ones are fast and show “Served from: cache”.