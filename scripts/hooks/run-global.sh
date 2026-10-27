#!/bin/sh
# Runs the machine's global git hook of the same name, if one is set up, so opting into this
# repo's hooks never switches off hooks that already run for every repository.
name="$1"
shift
global="$(git config --global --get core.hooksPath 2>/dev/null)"
case "$global" in "~"*) global="$HOME${global#\~}" ;; esac
if [ -n "$global" ] && [ -x "$global/$name" ]; then
  exec "$global/$name" "$@"
fi
exit 0
