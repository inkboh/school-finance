import * as cdk from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as rds from 'aws-cdk-lib/aws-rds'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2'
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins'
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager'
import * as cognito from 'aws-cdk-lib/aws-cognito'
import * as iam from 'aws-cdk-lib/aws-iam'
import { Construct } from 'constructs'
import * as path from 'path'

export class SchoolFinanceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    // ── VPC ─────────────────────────────────────────────────────────────────────
    // Lambda runs in private subnets with NAT for AWS API access.
    // RDS runs in isolated subnets (no internet route).
    const vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        { name: 'Public',   subnetType: ec2.SubnetType.PUBLIC,               cidrMask: 24 },
        { name: 'Private',  subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,  cidrMask: 24 },
        { name: 'Isolated', subnetType: ec2.SubnetType.PRIVATE_ISOLATED,     cidrMask: 24 },
      ],
    })

    // S3 gateway endpoint — free, routes S3 traffic within AWS network (bypasses NAT)
    vpc.addGatewayEndpoint('S3Endpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
      subnets: [{ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }],
    })

    // ── Security Groups ──────────────────────────────────────────────────────────
    const lambdaSg = new ec2.SecurityGroup(this, 'LambdaSg', {
      vpc,
      description: 'School Finance API Lambda',
      allowAllOutbound: true,
    })

    const dbSg = new ec2.SecurityGroup(this, 'DbSg', {
      vpc,
      description: 'School Finance RDS PostgreSQL',
      allowAllOutbound: false,
    })
    dbSg.addIngressRule(lambdaSg, ec2.Port.tcp(5432), 'Lambda to Postgres')

    // ── RDS PostgreSQL ───────────────────────────────────────────────────────────
    const db = new rds.DatabaseInstance(this, 'Database', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16,
      }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
      credentials: rds.Credentials.fromGeneratedSecret('postgres', {
        secretName: 'schoolfinance/db-credentials',
      }),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [dbSg],
      databaseName: 'schoolfinance',
      storageEncrypted: true,
      deletionProtection: false,
      removalPolicy: cdk.RemovalPolicy.SNAPSHOT,
      backupRetention: cdk.Duration.days(7),
      multiAz: false,
      allocatedStorage: 20,
      storageType: rds.StorageType.GP2,
      enablePerformanceInsights: false,
    })

    // ── App Secrets (JWT) ────────────────────────────────────────────────────────
    const jwtSecret = new secretsmanager.Secret(this, 'JwtSecret', {
      secretName: 'schoolfinance/jwt-secret',
      generateSecretString: {
        excludePunctuation: true,
        passwordLength: 64,
      },
      description: 'JWT access token signing secret',
    })

    const refreshSecret = new secretsmanager.Secret(this, 'RefreshSecret', {
      secretName: 'schoolfinance/refresh-secret',
      generateSecretString: {
        excludePunctuation: true,
        passwordLength: 64,
      },
      description: 'JWT refresh token signing secret',
    })

    // ── Cognito UserPool ─────────────────────────────────────────────────────────
    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'SchoolFinanceUsers',
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: true },
        fullname: { required: false, mutable: true },
      },
      customAttributes: {
        role: new cognito.StringAttribute({ mutable: true }),
      },
      passwordPolicy: {
        minLength: 8,
        requireDigits: true,
        requireUppercase: true,
        requireLowercase: true,
        requireSymbols: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })

    const userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool,
      userPoolClientName: 'SchoolFinanceWebClient',
      authFlows: { userPassword: true, userSrp: true },
      generateSecret: false,
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
      readAttributes: new cognito.ClientAttributes()
        .withStandardAttributes({ email: true, fullname: true })
        .withCustomAttributes('role'),
      writeAttributes: new cognito.ClientAttributes()
        .withStandardAttributes({ email: true, fullname: true })
        .withCustomAttributes('role'),
    })

    // ── S3 — Document Uploads ────────────────────────────────────────────────────
    const uploadsBucket = new s3.Bucket(this, 'UploadsBucket', {
      bucketName: `schoolfinance-uploads-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: false,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      cors: [{
        allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST],
        allowedOrigins: ['*'],
        allowedHeaders: ['*'],
        maxAge: 3600,
      }],
    })

    // ── S3 — Frontend Static Assets ──────────────────────────────────────────────
    const websiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
      bucketName: `schoolfinance-frontend-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    })

    // ── Lambda Function (Docker image) ───────────────────────────────────────────
    const apiFunction = new lambda.DockerImageFunction(this, 'ApiFunction', {
      functionName: 'SchoolFinanceApi',
      code: lambda.DockerImageCode.fromImageAsset(path.join(__dirname, '../../'), {
        file: 'Dockerfile.lambda',
      }),
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [lambdaSg],
      environment: {
        NODE_ENV:            'production',
        DB_SECRET_ARN:       db.secret!.secretArn,
        DB_HOST:             db.instanceEndpoint.hostname,
        DB_PORT:             db.dbInstanceEndpointPort,
        DB_NAME:             'schoolfinance',
        JWT_SECRET_ARN:               jwtSecret.secretArn,
        REFRESH_SECRET_ARN:           refreshSecret.secretArn,
        UPLOADS_BUCKET:               uploadsBucket.bucketName,
        COGNITO_USER_POOL_ID:         userPool.userPoolId,
        COGNITO_USER_POOL_CLIENT_ID:  userPoolClient.userPoolClientId,
      },
    })

    // Grant Lambda access to secrets, S3, and Cognito admin operations
    db.secret!.grantRead(apiFunction)
    jwtSecret.grantRead(apiFunction)
    refreshSecret.grantRead(apiFunction)
    uploadsBucket.grantReadWrite(apiFunction)
    apiFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'cognito-idp:AdminCreateUser',
        'cognito-idp:AdminUpdateUserAttributes',
        'cognito-idp:AdminEnableUser',
        'cognito-idp:AdminDisableUser',
        'cognito-idp:AdminSetUserPassword',
        'cognito-idp:AdminGetUser',
        'cognito-idp:ListUsers',
      ],
      resources: [userPool.userPoolArn],
    }))

    // ── API Gateway HTTP API ─────────────────────────────────────────────────────
    const httpApi = new apigwv2.HttpApi(this, 'HttpApi', {
      apiName: 'SchoolFinanceApi',
      // CORS is handled by Express; disable APIGW-level CORS to avoid double headers
      corsPreflight: undefined,
    })

    httpApi.addRoutes({
      path: '/api/{proxy+}',
      methods: [apigwv2.HttpMethod.ANY],
      integration: new integrations.HttpLambdaIntegration('ApiIntegration', apiFunction),
    })

    // ── CloudFront ───────────────────────────────────────────────────────────────
    // Extract hostname from APIGW URL for use as CloudFront origin
    const apiGwUrl = cdk.Fn.select(2, cdk.Fn.split('/', httpApi.url!))

    const apiOrigin = new origins.HttpOrigin(apiGwUrl, {
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
    })

    const s3Origin = origins.S3BucketOrigin.withOriginAccessControl(websiteBucket)

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: s3Origin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true,
      },
      additionalBehaviors: {
        '/api/*': {
          origin: apiOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        },
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html' },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html' },
      ],
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100, // US, Canada, Europe only — cheapest
    })

    // Update Lambda to know the real CLIENT_URL (CloudFront domain)
    apiFunction.addEnvironment('CLIENT_URL', `https://${distribution.distributionDomainName}`)

    // ── Deploy Frontend ──────────────────────────────────────────────────────────
    new s3deploy.BucketDeployment(this, 'DeployFrontend', {
      sources: [s3deploy.Source.asset(path.join(__dirname, '../../client/dist'))],
      destinationBucket: websiteBucket,
      distribution,
      distributionPaths: ['/*'],
    })

    // ── Outputs ──────────────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'AppUrl', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'School Finance Manager URL',
    })
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: httpApi.url ?? '',
      description: 'API Gateway URL (internal)',
    })
    new cdk.CfnOutput(this, 'UploadsBucketName', {
      value: uploadsBucket.bucketName,
      description: 'S3 bucket for document uploads',
    })
    new cdk.CfnOutput(this, 'DbEndpoint', {
      value: db.instanceEndpoint.hostname,
      description: 'RDS endpoint (use via Lambda invoke for migrations)',
    })
    new cdk.CfnOutput(this, 'DbSecretArn', {
      value: db.secret!.secretArn,
      description: 'Secrets Manager ARN for DB credentials',
    })
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
      description: 'Cognito User Pool ID',
    })
    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
    })
  }
}
