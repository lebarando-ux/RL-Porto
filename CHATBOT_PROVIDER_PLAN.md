# RiLey Chatbot Provider Plan

## Goal

Keep RiLey dependable when the current Gemini quota or provider is unavailable,
without exposing API credentials, inventing project prices, or silently moving
traffic to a provider that may incur charges.

## Current state

- The browser sends conversation history to the Express `POST /api/chat` route.
- `index.js` calls Gemini directly through `@google/genai`; the model is
  currently configured in the route.
- The deployment configuration supplies `GEMINI_API_KEY`.
- The browser displays a contact-email fallback when the API errors or returns
  an empty answer. Pricing questions have a deterministic answer and are not
  sent to the model.
- The 60 RPM figure is the current project limit reported by the owner. Gemini
  limits are project-, model-, and tier-specific; confirm the active value in
  AI Studio before treating it as a fixed platform-wide limit.

## Recommendation

Do not switch to OpenRouter solely to work around Gemini's free-tier quota.
First measure real usage and confirm the active Gemini limits. Keep Gemini as
the default while adding a provider boundary and, only if traffic requires it,
an explicitly configured secondary provider.

OpenRouter is a possible routing option, not a guaranteed free capacity
increase. Its published limits specify 20 RPM for free models, with a daily
limit that depends on whether the account has credits; upstream model providers
may also impose their own limits. Paid routing can add variable costs. Any
secondary provider should therefore be enabled only after selecting the model,
reviewing its price and terms, and setting an acceptable spend ceiling.

## Proposed phases

### 1. Confirm demand and quota

- Check the active Gemini API limits for this project and the selected model
  in [Google AI Studio rate limits](https://aistudio.google.com/rate-limit).
- Record request volume, 429s, other provider errors, and latency using
  aggregate counters. Do not log API keys, full prompts, or visitor messages.
- Compare peak traffic with the active RPM, TPM, and daily limits; RPM alone
  may not explain quota failures.

### 2. Keep deterministic behavior for known answers

- Keep pricing answers and other stable business facts out of model inference.
- Never have the model invent a quote. Direct visitors to
  `lebarando@gmail.com` for project-specific estimates.
- Keep the user-facing contact fallback when inference fails, and distinguish
  provider unavailability from invalid requests or configuration errors in
  server logs and monitoring.

### 3. Add a small provider adapter

- Keep `/api/chat` as the stable browser-facing API.
- Move provider-specific request/response handling behind one server-side
  interface. Normalize conversation roles, text output, errors, timeouts, and
  token limits there.
- Select providers through server environment configuration, for example
  `CHAT_PROVIDER=gemini` or `CHAT_PROVIDER=openrouter`; keep Gemini as the
  default until an alternate is deliberately configured.
- Store provider credentials only in deployment secrets. Never expose them to
  browser JavaScript or commit them to the repository.

### 4. Add controlled fallback only if justified

- On clearly transient primary-provider failures (such as rate limiting or
  temporary upstream/server errors), make at most one attempt with an
  explicitly configured secondary provider.
- Do not fall back on authentication, invalid-request, safety, or billing
  errors; those need correction or a user-facing failure, not another provider
  call.
- Bound request timeouts, output tokens, retry counts, and total latency. Avoid
  retrying at both the adapter and provider layers.
- Keep the same system instructions and deterministic business rules across
  providers. If the secondary route is paid, enforce a spend limit and provide
  an operator-controlled off switch.

### 5. Validate before enabling in production

- Test normal answers, English and Indonesian pricing answers, empty provider
  output, timeouts, 429/5xx failover, and non-retryable 4xx errors.
- Verify that credentials are absent from browser assets and logs.
- Exercise the configured deployment with the secondary provider disabled,
  then enable it gradually while watching error rate, latency, and cost.
- Document provider/model configuration and the operational rollback steps.

## Decision needed before implementation

Choose the acceptable cost posture and target provider/model before enabling
cross-provider failover:

1. **Free-only:** stay on Gemini and the known deterministic fallbacks; no
   guarantee that a provider outage or quota limit can be bypassed.
2. **Controlled paid fallback:** configure a selected OpenRouter model or
   another provider, with an explicit budget ceiling and an operator off switch.

The OpenRouter free-model limits should be rechecked at implementation time.
Provider catalogues, upstream availability, and rate limits can change.

## References

- [Gemini API rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)
- [OpenRouter limits](https://openrouter.ai/docs/api/reference/limits)
