import {gql, useQuery} from '@apollo/client';
import * as React from 'react';

import {PythonErrorInfo, PYTHON_ERROR_FRAGMENT} from '../app/PythonErrorInfo';
import {QueryCountdown} from '../app/QueryCountdown';
import {useQueryPersistedState} from '../hooks/useQueryPersistedState';
import {Box} from '../ui/Box';
import {CursorPaginationControls, CursorPaginationProps} from '../ui/CursorControls';
import {Loading} from '../ui/Loading';
import {NonIdealState} from '../ui/NonIdealState';

import {AssetSearch} from './AssetSearch';
import {AssetTable, ASSET_TABLE_FRAGMENT} from './AssetTable';
import {AssetNamespaceTableQuery} from './types/AssetNamespaceTableQuery';
import {AssetTableFragment as Asset} from './types/AssetTableFragment';

const POLL_INTERVAL = 15000;
const PAGE_SIZE = 25;

export const AssetNamespaceTable: React.FC<{prefixPath: string[]; switcher: React.ReactNode}> = ({
  prefixPath,
  switcher,
}) => {
  const [cursorStack, setCursorStack] = React.useState<string[]>(() => []);
  const [cursor, setCursor] = useQueryPersistedState<string | undefined>({queryKey: 'cursor'});
  const assetsQuery = useQuery<AssetNamespaceTableQuery>(ASSET_NAMESPACE_TABLE_QUERY, {
    notifyOnNetworkStatusChange: true,
    pollInterval: POLL_INTERVAL,
    variables: {
      prefix: prefixPath,
    },
  });

  return (
    <div style={{flexGrow: 1}}>
      <Loading allowStaleData queryResult={assetsQuery}>
        {({assetsOrError}) => {
          if (assetsOrError.__typename === 'PythonError') {
            return <PythonErrorInfo error={assetsOrError} />;
          }

          const assets = assetsOrError.nodes;

          if (!assets.length) {
            return (
              <NonIdealState
                icon="layers"
                title="Assets"
                description={
                  <p>
                    {prefixPath && prefixPath.length ? (
                      <span>
                        There are no matching materialized assets with the specified asset key.
                      </span>
                    ) : (
                      <span>There are no known materialized assets.</span>
                    )}
                    Any asset keys that have been specified with an{' '}
                    <code>AssetMaterialization</code> during a pipeline run will appear here. See
                    the{' '}
                    <a href="https://docs.dagster.io/_apidocs/solids#dagster.AssetMaterialization">
                      AssetMaterialization documentation
                    </a>{' '}
                    for more information.
                  </p>
                }
              />
            );
          }

          const showSwitcher =
            prefixPath.length || assets.some((asset) => asset.key.path.length > 1);
          const namespaceForAsset = (asset: Asset) => {
            return asset.key.path.slice(prefixPath.length, prefixPath.length + 1);
          };
          const namespaces = Array.from(
            new Set(assets.map((asset) => JSON.stringify(namespaceForAsset(asset)))),
          )
            .map((x) => JSON.parse(x))
            .sort();
          const cursorIndex = cursor
            ? namespaces.findIndex((ns) => cursor < JSON.stringify([...prefixPath, ...ns]))
            : 0;
          const slice =
            cursorIndex < 0 ? [] : namespaces.slice(cursorIndex, cursorIndex + PAGE_SIZE);
          const hasNextCursor = cursorIndex >= 0 && namespaces.length > PAGE_SIZE + cursorIndex;
          const matchingAssets = filterAssetsByNamespace(
            assets,
            slice.map((ns) => [...prefixPath, ...ns]),
          );
          const paginationProps: CursorPaginationProps = {
            hasPrevCursor: !!cursor,
            hasNextCursor,
            popCursor: () => {
              const nextStack = [...cursorStack];
              setCursor(nextStack.pop());
              setCursorStack(nextStack);
            },
            advanceCursor: () => {
              if (cursor) {
                setCursorStack((current) => [...current, cursor]);
              }
              if (!slice.length) {
                return;
              }
              setCursor(JSON.stringify([...prefixPath, ...slice[slice.length - 1]]));
            },
            reset: () => {
              setCursorStack([]);
              setCursor(undefined);
            },
          };
          return (
            <>
              <AssetTable
                assets={matchingAssets}
                actionBarComponents={
                  <>
                    {showSwitcher ? switcher : null}
                    <AssetSearch />
                    <QueryCountdown pollInterval={POLL_INTERVAL} queryResult={assetsQuery} />
                  </>
                }
                prefixPath={prefixPath || []}
                displayPathForAsset={namespaceForAsset}
                maxDisplayCount={PAGE_SIZE}
                requery={(_) => [{query: ASSET_NAMESPACE_TABLE_QUERY}]}
              />
              {hasNextCursor || cursorIndex ? (
                <Box margin={{top: 20}}>
                  <CursorPaginationControls {...paginationProps} />
                </Box>
              ) : null}
            </>
          );
        }}
      </Loading>
    </div>
  );
};

const filterAssetsByNamespace = (assets: Asset[], paths: string[][]) => {
  return assets.filter((asset) =>
    paths.some((path) => path.every((part, i) => part === asset.key.path[i])),
  );
};

const ASSET_NAMESPACE_TABLE_QUERY = gql`
  query AssetNamespaceTableQuery($prefix: [String!]) {
    assetsOrError(prefix: $prefix) {
      __typename
      ... on AssetConnection {
        nodes {
          id
          ...AssetTableFragment
        }
      }
      ...PythonErrorFragment
    }
  }

  ${PYTHON_ERROR_FRAGMENT}
  ${ASSET_TABLE_FRAGMENT}
`;
