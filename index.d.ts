declare module 'athena-express' {
    import * as aws from 'aws-sdk';
    interface ConnectionConfigInterface {
        aws: typeof aws;
        s3: string;
        getStats: boolean;
    }

    type GenericObject = {
        [names: string]: any;
    };

    interface QueryResultsInterface<T> {
        Items: T[];
        DataScannedInMB: number;
        QueryCostInUSD: number;
        EngineExecutionTimeInMillis: number;
        S3Location: string;
        Count: number;
    }

    interface QueryInterface {
        sql: string;
        db: string;
    }

    type QueryResult = QueryResultsInterface<any>;
    type QueryFunc = (query: QueryInterface) => Promise<QueryResult>;
    interface AthenaExpressInterface {
        new: (config: ConnectionConfigInterface) => any;
        query: QueryFunc;
    }

    class AthenaExpress {
        new: (config: ConnectionConfigInterface) => any;
        constructor(config: ConnectionConfigInterface);
        query: QueryFunc;
    }
}

