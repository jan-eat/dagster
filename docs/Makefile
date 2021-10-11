docs_dev_install:
	cd next; yarn; cd ..;

dev:
	cd next; yarn dev;

crag_dev:
	cd next; yarn crag-dev;

snapshot:
	cd next; yarn snapshot && yarn crag-snapshot; cd ..;

reindex_search:
	docker run -it --env-file=.env -e "CONFIG=$(cat ./config.json | jq -r tostring)" algolia/docsearch-scraper
