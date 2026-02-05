#!/bin/sh
set -ex

# Verifique se a variável BOT_NAME está definida
echo "BOT_NAME is set to: ${BOT_NAME}"

# Verifique se o diretório existe
if [ -d "/usr/src/app/tokens/${BOT_NAME}" ]; then
  echo "Directory /usr/src/app/tokens/${BOT_NAME} exists. Removing it to clear all session data and locks."
  ls -la "/usr/src/app/tokens/"
  rm -rf "/usr/src/app/tokens/${BOT_NAME}"
  echo "Session directory removed."
else
  echo "Directory /usr/src/app/tokens/${BOT_NAME} does not exist. Nothing to clean."
fi

echo "Cleanup script finished."
