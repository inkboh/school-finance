#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from 'aws-cdk-lib'
import { SchoolFinanceStack } from '../lib/school-finance-stack'

const app = new cdk.App()

new SchoolFinanceStack(app, 'SchoolFinanceStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT ?? '705285596598',
    region:  process.env.CDK_DEFAULT_REGION  ?? 'us-east-1',
  },
  description: 'Riverdale Academy School Finance Manager — serverless AWS deployment',
})
