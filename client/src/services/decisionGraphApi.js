import apiClient from "./apiClient";

export const getDecisionGraph = async (params = {}) => {
  const response = await apiClient.get("/api/decision-graph", { params });
  return response.data;
};

const edgeKey = ({ source, target, type }) =>
  JSON.stringify([source, target, type]);

// The graph endpoint returns a window of nodes, so collect every window before
// handing data to the canvas. A larger page size keeps the number of requests
// low while remaining within the API's supported limit.
export const getAllDecisionGraphPages = async (params = {}) => {
  const nodesById = new Map();
  const edgesByKey = new Map();
  let page = 1;
  let pagination;

  do {
    const graphPage = await getDecisionGraph({
      ...params,
      page,
      limit: params.limit ?? 200,
    });

    const nodes = Array.isArray(graphPage?.nodes) ? graphPage.nodes : [];
    const edges = Array.isArray(graphPage?.edges) ? graphPage.edges : [];

    nodes.forEach((node) => nodesById.set(node.id, node));
    edges.forEach((edge) => edgesByKey.set(edgeKey(edge), edge));

    pagination = graphPage?.pagination;
    if (!pagination?.hasMore) break;

    page = Number.isInteger(pagination.page) ? pagination.page + 1 : page + 1;
  } while (pagination?.hasMore);

  return {
    nodes: [...nodesById.values()],
    edges: [...edgesByKey.values()],
    pagination,
  };
};

export const getDecisionNeighbors = async (id) => {
  const response = await apiClient.get(`/api/decision-graph/${id}/neighbors`);
  return response.data;
};
