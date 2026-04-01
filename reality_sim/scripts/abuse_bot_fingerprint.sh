#!/bin/bash

echo "🔥 BOT FINGERPRINT EVASION SIMULATION"

URL="http://localhost:3000/search/providers?q=test"

UAS=(
"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"
"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15"
"Mozilla/5.0 (X11; Linux x86_64) Gecko/20100101 Firefox/121.0"
"Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148"
"Mozilla/5.0 (Android 13; Pixel 7) Chrome/120.0.0.0 Mobile Safari/537.36"
)

LANGS=("en-US" "en-GB" "fr-FR" "de-DE" "es-ES")
REFS=("https://google.com" "https://bing.com" "https://duckduckgo.com" "https://yahoo.com")

for round in {1..100}; do
  UA=${UAS[$RANDOM % ${#UAS[@]}]}
  LANG=${LANGS[$RANDOM % ${#LANGS[@]}]}
  REF=${REFS[$RANDOM % ${#REFS[@]}]}

  curl -s -o /dev/null -w "%{http_code}\n" \
    -H "User-Agent: $UA" \
    -H "Accept-Language: $LANG" \
    -H "Referer: $REF" \
    "$URL" &
done

wait
echo "✅ Bot fingerprint evasion simulation complete"
