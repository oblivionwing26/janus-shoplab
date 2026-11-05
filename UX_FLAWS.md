# Seeded UX flaws

Ground truth for Janus SynthLab. Each flaw below was introduced on purpose in F0.7-B so that
friction signals and UI patches can be checked against a known answer.

> **Janus agents must not read this file.** It names the exact code behind each flaw. Janus
> excludes it from cloned workspaces and from any code context it gives to agents.

The pricing rules, the API and server-side validation are unchanged: these flaws live only in the
presentation layer, so ShopLab's own tests keep passing.

| ID   | Flaw                                                  | Main code                                                   |
| ---- | ----------------------------------------------------- | ----------------------------------------------------------- |
| UX-1 | Shipping costs appear only at the last step           | `src/app/cart/page.tsx`, `src/components/totals-table.tsx`  |
| UX-2 | Coupon field hidden behind an ambiguous link          | `src/app/cart/page.tsx`, `src/components/more-options.tsx`  |
| UX-3 | Sign-up form clears every field when validation fails | `src/app/register/page.tsx`, `src/components/json-form.tsx` |

---

## UX-1 · Shipping costs appear only at the last step

**Code.** The cart page renders `<TotalsTable showShipping={false} />`, which drops the shipping
row and shows a "Total" without shipping. The free-shipping threshold is not mentioned anywhere
before checkout. `/checkout` renders the full table, so shipping (4,99 €) appears there for the
first time.

**Reproduce.**

1. Sign in as `ana@shoplab.test` (password in `prisma/seed.ts`).
2. Add _Taza de cerámica_ (12,90 €) to the cart. The cart shows `Total 12,90 €` and no shipping.
3. Click _Ir a pagar_. Checkout shows `Envío 4,99 €` and `Total 17,89 €`.

**Expected vs actual.** The cart should show shipping, or at least the free-shipping threshold,
before the shopper commits to paying. Instead the total jumps by 4,99 € at the last step.

**Signals Janus should detect.**

- Back-navigation from `/checkout` to `/cart` right after the totals are shown (backtrack).
- Abandonment at checkout, mainly for price-sensitive personas.
- Extra steps compared with the competent baseline (going back to add items to reach 50 €).

**Reference fix.** Render the cart table with shipping (`showShipping` back to its default) and
show the free-shipping threshold (`Envío gratis a partir de 50,00 €`) in the cart.

---

## UX-2 · Coupon field hidden behind an ambiguous link

**Code.** The cart wraps the coupon form in `<MoreOptions label="Otras opciones">`, a link that
toggles hidden content. Nothing on the page says the coupon is there: the accessibility tree shows
only `link "Otras opciones"`, and the link has no `aria-expanded` or description.

**Reproduce.**

1. Sign in and add any product to the cart.
2. Look for a coupon field on `/cart`: there is none, and no heading mentions coupons.
3. Click _Otras opciones_. The _Código del cupón_ field and _Aplicar cupón_ button appear.
4. Apply `BIENVENIDA10`: the discount shows as before.

**Expected vs actual.** A shopper holding a coupon should see where to enter it. Instead the field
is only reachable by guessing that "Otras opciones" hides it.

**Signals Janus should detect.**

- Personas told they have a coupon finish checkout without applying it (task success with a lower
  discount than expected), or abandon while searching.
- Extra steps and exploratory clicks on the cart page compared with the baseline.

**Reference fix.** Show the coupon form directly under a visible heading (_Cupón de descuento_),
or at least label the link clearly (_¿Tienes un cupón?_) and expose its state with
`aria-expanded`.

---

## UX-3 · Sign-up form clears every field when validation fails

**Code.** The sign-up page passes `resetOnError` to `JsonForm`, which calls `form.reset()` when the
API rejects the submission. Name, email, password and address are all cleared, not just the
password.

**Reproduce.**

1. Sign out and open `/register`.
2. Fill in name, email and address, and a password of 5 characters.
3. Click _Crear cuenta_. The error _Revisa los campos del formulario._ appears and every field is
   empty.
4. The same happens with an email that is already registered (`ana@shoplab.test`).

**Expected vs actual.** After a validation error the form should keep what the shopper typed
(except, at most, the password) and point at the field to fix. Instead the shopper must type
everything again.

**Signals Janus should detect.**

- Repeated form errors on `/register` and re-typing of the same fields (form error).
- Abandonment after the second failed attempt, mainly for low-patience personas.

**Reference fix.** Remove `resetOnError` from the sign-up form so values are kept, and report which
field failed.
