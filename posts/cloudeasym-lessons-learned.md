---
title: "CloudeasyML: Lessons from Building an MLOps Platform"
date: "2025-01-10"
tags: ["MLOps", "AWS", "Python"]
excerpt: "Key insights and architectural decisions from building a production MLOps platform on AWS."
---

# CloudeasyML: Lessons from Building an MLOps Platform

Building [CloudeasyML](https://github.com/Sarvesh-GanesanW/CloudEasyML) taught me more about production ML than any course or tutorial ever could. In this post, I'll share the architectural decisions, mistakes, and lessons learned from building an end-to-end MLOps platform on AWS.

## The Vision

CloudeasyML was born out of frustration. Every ML project I worked on had the same problems:
- Models worked in notebooks but failed in production
- No standard way to deploy models
- Monitoring was an afterthought
- Retraining required manual intervention

I wanted a platform that made deploying and managing ML models as easy as pushing code to GitHub.

## Architecture Overview

The platform consists of five main components:

```
┌─────────────┐
│   User CLI  │
└──────┬──────┘
       │
┌──────▼──────────────────────────┐
│     API Gateway + Lambda        │
└──────┬──────────────────────────┘
       │
┌──────▼──────┬─────────┬─────────┐
│  S3 Models  │ SageMaker│  ECR   │
└─────────────┴─────────┴─────────┘
```

### Component 1: CLI Tool

The entry point for users:

```python
# cloudeasym deploy --model model.pkl --name customer-churn
class DeployCommand:
    def execute(self, model_path: str, name: str):
        # 1. Validate model
        model = self.load_and_validate(model_path)

        # 2. Create deployment package
        package = self.package_model(model, name)

        # 3. Upload to S3
        s3_path = self.upload_to_s3(package)

        # 4. Deploy to SageMaker
        endpoint = self.deploy_to_sagemaker(s3_path, name)

        print(f"Model deployed: {endpoint}")
```

**Lesson 1:** Users want simple commands. `cloudeasym deploy` beats a 20-step deployment guide.

### Component 2: Model Packaging

One of the trickiest parts was creating a standard package format:

```python
class ModelPackage:
    """
    Standard format for model packages
    """
    def __init__(self):
        self.model = None
        self.preprocessor = None
        self.metadata = {}

    def save(self, path: str):
        """
        Saves model, preprocessor, and metadata in a standard format
        """
        with tarfile.open(path, 'w:gz') as tar:
            # Save model
            joblib.dump(self.model, 'model.pkl')
            tar.add('model.pkl')

            # Save preprocessor
            if self.preprocessor:
                joblib.dump(self.preprocessor, 'preprocessor.pkl')
                tar.add('preprocessor.pkl')

            # Save metadata
            with open('metadata.json', 'w') as f:
                json.dump(self.metadata, f)
            tar.add('metadata.json')
```

**Lesson 2:** Standardization is hard but essential. We went through 3 package format iterations before settling on this.

### Component 3: Auto-Scaling

SageMaker endpoints don't auto-scale out of the box. We built custom scaling:

```python
def configure_autoscaling(endpoint_name: str):
    """
    Configures auto-scaling for SageMaker endpoint
    """
    autoscaling = boto3.client('application-autoscaling')

    # Register scalable target
    autoscaling.register_scalable_target(
        ServiceNamespace='sagemaker',
        ResourceId=f'endpoint/{endpoint_name}/variant/AllTraffic',
        ScalableDimension='sagemaker:variant:DesiredInstanceCount',
        MinCapacity=1,
        MaxCapacity=10
    )

    # Define scaling policy
    autoscaling.put_scaling_policy(
        PolicyName=f'{endpoint_name}-scaling',
        ServiceNamespace='sagemaker',
        ResourceId=f'endpoint/{endpoint_name}/variant/AllTraffic',
        ScalableDimension='sagemaker:variant:DesiredInstanceCount',
        PolicyType='TargetTrackingScaling',
        TargetTrackingScalingPolicyConfiguration={
            'TargetValue': 70.0,  # Target 70% CPU
            'PredefinedMetricSpecification': {
                'PredefinedMetricType': 'SageMakerVariantInvocationsPerInstance'
            }
        }
    )
```

**Lesson 3:** Don't assume cloud services have all the features you need. Sometimes you have to build them yourself.

## Monitoring & Observability

We integrated CloudWatch for monitoring:

```python
class ModelMonitor:
    """
    Monitors model performance and data drift
    """
    def __init__(self, endpoint_name: str):
        self.endpoint = endpoint_name
        self.cloudwatch = boto3.client('cloudwatch')

    def log_prediction(self, features: dict, prediction: float, latency: float):
        """
        Logs prediction metrics to CloudWatch
        """
        self.cloudwatch.put_metric_data(
            Namespace='CloudeasyML',
            MetricData=[
                {
                    'MetricName': 'PredictionLatency',
                    'Value': latency,
                    'Unit': 'Milliseconds',
                    'Dimensions': [
                        {'Name': 'Endpoint', 'Value': self.endpoint}
                    ]
                },
                {
                    'MetricName': 'PredictionValue',
                    'Value': prediction,
                    'Unit': 'None',
                    'Dimensions': [
                        {'Name': 'Endpoint', 'Value': self.endpoint}
                    ]
                }
            ]
        )
```

## Cost Optimization

Initial monthly AWS costs: **$850**
Optimized monthly costs: **$320**

### How we cut costs by 62%:

1. **Spot instances for training** (-40%)
2. **Serverless endpoints for low-traffic models** (-30%)
3. **S3 lifecycle policies** (-15%)
4. **Reserved instances for high-traffic endpoints** (-15%)

```python
def choose_instance_type(expected_qps: float) -> str:
    """
    Chooses cost-effective instance type based on traffic
    """
    if expected_qps < 1:
        return 'serverless'  # Pay per invocation
    elif expected_qps < 10:
        return 'ml.t3.medium'  # Cheap, burstable
    elif expected_qps < 100:
        return 'ml.m5.large'  # Standard
    else:
        return 'ml.c5.2xlarge'  # High performance
```

**Lesson 4:** Right-sizing instances can save massive amounts of money.

## Biggest Mistakes

### 1. Not Planning for Model Versioning

Initially, we didn't version models properly:

```python
# Bad: Overwrites previous version
s3.upload_file('model.pkl', bucket, 'models/customer-churn/model.pkl')
```

This caused production issues when we needed to rollback. We fixed it:

```python
# Good: Versioned models
version = generate_version_id()
s3.upload_file(
    'model.pkl',
    bucket,
    f'models/customer-churn/v{version}/model.pkl'
)
```

### 2. Ignoring Cold Starts

SageMaker endpoints have terrible cold start times (30-60 seconds). We implemented warm pools:

```python
def keep_warm(endpoint_name: str):
    """
    Sends periodic requests to keep endpoint warm
    """
    while True:
        try:
            client.invoke_endpoint(
                EndpointName=endpoint_name,
                Body=json.dumps({'warmup': True})
            )
        except Exception as e:
            logger.error(f"Warmup failed: {e}")

        time.sleep(300)  # Every 5 minutes
```

### 3. Poor Error Handling

Our first deployment script had minimal error handling. This led to half-deployed models and broken endpoints.

We learned to be defensive:

```python
def deploy_model(model_path: str):
    try:
        # Upload model
        s3_path = upload_model(model_path)
    except S3UploadError as e:
        logger.error(f"Upload failed: {e}")
        return {'status': 'failed', 'stage': 'upload'}

    try:
        # Create endpoint
        endpoint = create_endpoint(s3_path)
    except EndpointCreationError as e:
        logger.error(f"Endpoint creation failed: {e}")
        # Cleanup uploaded model
        cleanup_s3(s3_path)
        return {'status': 'failed', 'stage': 'deployment'}

    return {'status': 'success', 'endpoint': endpoint}
```

## Metrics That Matter

After 6 months in production:

- **15 models deployed** across different use cases
- **99.5% uptime** across all endpoints
- **<500ms P95 latency** for predictions
- **$320/month** in AWS costs
- **3 minutes** average deployment time

## What's Next

We're working on:
1. **A/B testing framework** - Easy model comparison
2. **Automated retraining** - Trigger retraining on drift detection
3. **Multi-cloud support** - GCP and Azure alongside AWS

## Key Takeaways

1. **Start simple** - Don't over-engineer v1
2. **Standardize early** - Model packaging format is critical
3. **Monitor everything** - You can't improve what you don't measure
4. **Cost matters** - Right-sizing saves money
5. **Plan for failures** - Things will break, handle it gracefully

---

*CloudeasyML is open source: [GitHub](https://github.com/Sarvesh-GanesanW/CloudEasyML)*
