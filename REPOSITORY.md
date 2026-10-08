# Proxima source repository

**Official repository (Conzex Global Private Limited):**  
https://github.com/conzex/Proxima

Proxima is proprietary product software — not open source. See [LICENSE](LICENSE).

```bash
git clone https://github.com/conzex/Proxima.git
cd Proxima
```

## Versioning

Product version is stored in [`VERSION`](VERSION) (currently **1.2.0**).

- Patch segment counts **0 → 9**, then rolls to **0** and the minor segment increments.
- When minor would exceed **11**, it resets to **0** and the major segment increments.

```bash
npm run version:bump   # bump VERSION + sync package.json files
npm run version:sync   # copy VERSION → backend/frontend/ide manifests
```
