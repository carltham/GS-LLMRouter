# Open decisions

Status: draft. These are questions, not decisions.

1. Where does the project finally live: `GS-LLMRouter/` at the top level, or nested as it is now?
2. Is the blacklist seeded from configuration only, or also editable through the admin API in
   production?
3. What quality tier does each model get, and who reviews it?
4. Should automatic retry with the next candidate be enabled by default?
5. What counts as a failure for feedback: provider error, client retry, or a human judgement?
6. How long are decisions and feedback retained, and in what export format?
7. Should provider choice be part of the client request, or only of policy?
8. Do local models carry a price of zero, or are they excluded from cost ranking?
9. When the router moves into GS-EBS-Brain, does it keep its HTTP surface or become an internal
   module only?
10. Is `node:sqlite` acceptable, or should the catalog move to a supported database driver?