#!/usr/bin/env bash
# Put whatever is on the clipboard into .dev.vars, without printing it.
#
#   ./scripts/set-dev-secret.sh DISCORD_CLIENT_ID
#   ./scripts/set-dev-secret.sh DISCORD_CLIENT_SECRET
#
# The value is read at runtime and never echoed, logged, or passed as an
# argument (argv is visible to other processes via /proc). Only its length and
# a shape check are reported back.
set -euo pipefail

KEY="${1:-}"
if [[ -z "$KEY" ]]; then
	echo "usage: $0 <ENV_VAR_NAME>" >&2
	exit 64
fi

cd "$(dirname "$0")/.."
FILE=".dev.vars"

if ! git check-ignore -q "$FILE" 2>/dev/null; then
	echo "refusing: $FILE is not gitignored — a secret written here could be committed" >&2
	exit 1
fi

read_clipboard() {
	if command -v wl-paste >/dev/null 2>&1; then wl-paste -n
	elif command -v xclip >/dev/null 2>&1; then xclip -o -selection clipboard
	elif command -v xsel >/dev/null 2>&1; then xsel -b
	else echo "no clipboard tool (wl-paste, xclip or xsel)" >&2; return 1
	fi
}

# Trim surrounding whitespace and any stray newline a copy picked up.
VALUE="$(read_clipboard | tr -d '\r\n' | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')"

if [[ -z "$VALUE" ]]; then
	echo "clipboard is empty — copy the value first" >&2
	exit 1
fi

# Catch the common mistake: the wrong thing copied.
case "$KEY" in
	*CLIENT_ID)
		if ! [[ "$VALUE" =~ ^[0-9]{15,25}$ ]]; then
			echo "that does not look like a Discord client id (expected ~19 digits, got ${#VALUE} chars)" >&2
			exit 1
		fi ;;
	*CLIENT_SECRET)
		if ! [[ "$VALUE" =~ ^[A-Za-z0-9_-]{20,}$ ]]; then
			echo "that does not look like a client secret (got ${#VALUE} chars)" >&2
			exit 1
		fi
		if [[ "$VALUE" == https://* ]]; then
			echo "that is a URL, not a secret — did you copy the webhook by mistake?" >&2
			exit 1
		fi ;;
esac

if grep -qE "^${KEY}=" "$FILE"; then
	# Write via a temp file so a failure cannot truncate .dev.vars.
	tmp="$(mktemp "${FILE}.XXXXXX")"
	trap 'rm -f "$tmp"' EXIT
	VALUE="$VALUE" KEY="$KEY" awk '
		BEGIN { k = ENVIRON["KEY"]; v = ENVIRON["VALUE"] }
		$0 ~ "^" k "=" { print k "=" v; next }
		{ print }
	' "$FILE" > "$tmp"
	chmod 600 "$tmp"
	mv "$tmp" "$FILE"
	trap - EXIT
else
	printf '%s=%s\n' "$KEY" "$VALUE" >> "$FILE"
fi
chmod 600 "$FILE"

echo "$KEY set (${#VALUE} chars) in $FILE — value not printed"
