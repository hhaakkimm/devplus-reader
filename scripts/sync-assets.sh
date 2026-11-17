#!/bin/sh
rm -rf public/content && cp -R "${DEVPLUS:-../devplus}/apps/web/public/content" public/content
