.PHONY: build test clean install-deps build-agent build-app dev-agent dev-app

build:
	anchor build

test:
	anchor test

clean:
	anchor clean
	rm -rf node_modules agent/node_modules app/node_modules app/.next
	rm -rf target .anchor

install-deps:
	yarn install
	cd agent && yarn install
	cd app && yarn install

build-agent:
	cd agent && yarn build

build-app:
	cd app && yarn build

dev-agent:
	cd agent && yarn dev

dev-app:
	cd app && yarn dev

update-program-ids:
	@echo "Run 'anchor keys list' to get program IDs"
	@echo "Then update:"
	@echo "  - Anchor.toml [programs.devnet]"
	@echo "  - programs/*/src/lib.rs declare_id!"
	@echo "  - app/src/lib/anchor.ts PROGRAM_IDS"
