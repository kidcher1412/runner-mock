type Endpoint = {
  path: string;
  method: string; // duy nhất, GET / POST / PUT ...
  requestBody?: any;
  responses?: {
    status: string;
    description?: string;
    content?: Record<string, any>;
  }[];
};