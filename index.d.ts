declare module 'athena-express' {
    import { S3 } from '@aws-sdk/client-s3';
    import { Athena } from '@aws-sdk/client-athena';
    interface ConnectionConfigInterface {
        athena: typeof Athena,
        s3: typeof S3,
        s3Bucket: string;
        getStats: boolean;
        db: string,
        workgroup: string,
        formatJson: boolean,
        retry: number,
        ignoreEmpty: boolean,
        encryption: Record<string, string>,
        skipResults: boolean,
        waitForResults: boolean,
        catalog: string,
        pagination: string
    }

    interface QueryResultsInterface<T> {
        Items: T[];
        DataScannedInMB: number;
        QueryCostInUSD: number;
        EngineExecutionTimeInMillis: number;
        S3Location: string;
        QueryExecutionId: string;
        NextToken: string;
        Count: number;
        DataScannedInBytes: number;
        TotalExecutionTimeInMillis: number;
        QueryQueueTimeInMillis: number;
        QueryPlanningTimeInMillis: number;
        ServiceProcessingTimeInMillis: number;
    }

    interface QueryObjectInterface {
        sql: string;
        db: string;
    }
    type DirectQueryString = string;
    type QueryExecutionId = string;

    type OptionalQueryResultsInterface<T> = Partial<QueryResultsInterface<T>> & Pick<QueryResultsInterface<T>, 'QueryExecutionId'>;
    type QueryResult<T> = OptionalQueryResultsInterface<T>;
    type QueryFunc<T> = (query: QueryObjectInterface|DirectQueryString|QueryExecutionId) => Promise<QueryResult<T>>;

    class AthenaExpress<T> {
        public new: (config: Partial<ConnectionConfigInterface>) => any;
        public query: QueryFunc<T>;
        constructor(config: Partial<ConnectionConfigInterface>);
    }
}
