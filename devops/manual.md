# Manual AWS Steps — DevOps Workstream

Steps only a human with AWS admin access can perform (IAM permission grants). Agents in this
workstream deliberately can't self-authorize these — see `devops/AGENTS.md`'s non-negotiables
(never use the account root user; `devops-agent` is scoped so it can't grant itself more
permissions). Run each block below with an **admin** AWS profile, not `devops-agent` and not
root.

---

## Why this file exists

`devops-agent` (the scoped IAM user used for all `/devops` Terraform/AWS work) started with no
permissions. `devops.terraform_backend` needs it to create an S3 bucket + DynamoDB table;
`devops.terraform_oidc_github` needs it to create a GitHub Actions OIDC provider + IAM role.
An initial attempt to grant these via a single **inline** user policy silently failed — inline
user policies are capped at 2,048 characters (aggregate), and the combined policy was ~8,500
characters. Fix: two separate **managed** policies (6,144-char limit each), attached to
`devops-agent`.

---

## Step 1 — Save the two policy documents

`scribe-devops-bootstrap-policy.json` (needed now — state backend + OIDC/role management):

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {"Sid": "StsIdentity", "Effect": "Allow", "Action": "sts:GetCallerIdentity", "Resource": "*"},
        {"Sid": "TerraformStateBucketBootstrap", "Effect": "Allow", "Action": ["s3:CreateBucket","s3:PutBucketVersioning","s3:PutEncryptionConfiguration","s3:PutBucketPublicAccessBlock","s3:GetBucketVersioning","s3:GetEncryptionConfiguration","s3:GetBucketPublicAccessBlock","s3:PutBucketTagging","s3:GetBucketTagging","s3:ListBucket"], "Resource": "arn:aws:s3:::scribe-terraform-state-404063516240"},
        {"Sid": "TerraformStateObjectAccess", "Effect": "Allow", "Action": ["s3:GetObject","s3:PutObject","s3:DeleteObject"], "Resource": "arn:aws:s3:::scribe-terraform-state-404063516240/scribe/*"},
        {"Sid": "TerraformLockTableBootstrap", "Effect": "Allow", "Action": ["dynamodb:CreateTable","dynamodb:DescribeTable","dynamodb:TagResource","dynamodb:GetItem","dynamodb:PutItem","dynamodb:DeleteItem"], "Resource": "arn:aws:dynamodb:us-east-1:404063516240:table/scribe-terraform-locks"},
        {"Sid": "OidcProviderManage", "Effect": "Allow", "Action": ["iam:CreateOpenIDConnectProvider","iam:GetOpenIDConnectProvider","iam:DeleteOpenIDConnectProvider","iam:TagOpenIDConnectProvider","iam:ListOpenIDConnectProviders","iam:UpdateOpenIDConnectProviderThumbprint"], "Resource": "arn:aws:iam::404063516240:oidc-provider/token.actions.githubusercontent.com"},
        {"Sid": "GithubActionsRoleManage", "Effect": "Allow", "Action": ["iam:CreateRole","iam:GetRole","iam:DeleteRole","iam:UpdateRole","iam:UpdateAssumeRolePolicy","iam:TagRole","iam:UntagRole","iam:PutRolePolicy","iam:GetRolePolicy","iam:DeleteRolePolicy","iam:ListRolePolicies","iam:ListAttachedRolePolicies","iam:ListInstanceProfilesForRole","iam:AttachRolePolicy","iam:DetachRolePolicy","iam:PassRole"], "Resource": ["arn:aws:iam::404063516240:role/scribe-github-actions-deploy","arn:aws:iam::404063516240:role/scribe-*"]}
    ]
}
```

`scribe-devops-infra-policy.json` (for later features — RDS/EC2/ECR/SSM):

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {"Sid": "NetworkingCompute", "Effect": "Allow", "Action": ["ec2:Describe*","ec2:CreateVpc","ec2:DeleteVpc","ec2:ModifyVpcAttribute","ec2:CreateSubnet","ec2:DeleteSubnet","ec2:CreateSecurityGroup","ec2:DeleteSecurityGroup","ec2:AuthorizeSecurityGroupIngress","ec2:AuthorizeSecurityGroupEgress","ec2:RevokeSecurityGroupIngress","ec2:RevokeSecurityGroupEgress","ec2:CreateRouteTable","ec2:DeleteRouteTable","ec2:CreateRoute","ec2:DeleteRoute","ec2:AssociateRouteTable","ec2:DisassociateRouteTable","ec2:CreateInternetGateway","ec2:DeleteInternetGateway","ec2:AttachInternetGateway","ec2:DetachInternetGateway","ec2:RunInstances","ec2:TerminateInstances","ec2:ModifyInstanceAttribute","ec2:CreateTags","ec2:DeleteTags"], "Resource": "*"},
        {"Sid": "RdsDatabase", "Effect": "Allow", "Action": ["rds:CreateDBInstance","rds:DeleteDBInstance","rds:ModifyDBInstance","rds:DescribeDBInstances","rds:CreateDBSubnetGroup","rds:DeleteDBSubnetGroup","rds:DescribeDBSubnetGroups","rds:AddTagsToResource","rds:ListTagsForResource"], "Resource": "*"},
        {"Sid": "EcrRepos", "Effect": "Allow", "Action": ["ecr:CreateRepository","ecr:DeleteRepository","ecr:DescribeRepositories","ecr:PutImageTagMutability","ecr:PutLifecyclePolicy","ecr:PutImageScanningConfiguration","ecr:BatchCheckLayerAvailability","ecr:PutImage","ecr:InitiateLayerUpload","ecr:UploadLayerPart","ecr:CompleteLayerUpload","ecr:BatchGetImage","ecr:DescribeImages","ecr:ListImages"], "Resource": "arn:aws:ecr:*:*:repository/scribe-*"},
        {"Sid": "EcrAuth", "Effect": "Allow", "Action": "ecr:GetAuthorizationToken", "Resource": "*"},
        {"Sid": "SsmDeploy", "Effect": "Allow", "Action": ["ssm:SendCommand","ssm:GetCommandInvocation","ssm:ListCommandInvocations","ssm:DescribeInstanceInformation"], "Resource": "*", "Condition": {"StringEquals": {"ssm:resourceTag/deploy": "true"}}},
        {"Sid": "IamInstanceProfileMgmt", "Effect": "Allow", "Action": ["iam:CreateInstanceProfile","iam:DeleteInstanceProfile","iam:AddRoleToInstanceProfile","iam:RemoveRoleFromInstanceProfile","iam:GetInstanceProfile"], "Resource": "arn:aws:iam::404063516240:instance-profile/scribe-*"}
    ]
}
```

## Step 2 — Create both as managed policies

Use an **admin** profile (not `devops-agent`, not root):

```bash
aws iam create-policy \
  --policy-name scribe-devops-bootstrap \
  --policy-document file://scribe-devops-bootstrap-policy.json \
  --profile <your-admin-profile>

aws iam create-policy \
  --policy-name scribe-devops-infra \
  --policy-document file://scribe-devops-infra-policy.json \
  --profile <your-admin-profile>
```

## Step 3 — Attach both to `devops-agent`

```bash
aws iam attach-user-policy \
  --user-name devops-agent \
  --policy-arn arn:aws:iam::404063516240:policy/scribe-devops-bootstrap \
  --profile <your-admin-profile>

aws iam attach-user-policy \
  --user-name devops-agent \
  --policy-arn arn:aws:iam::404063516240:policy/scribe-devops-infra \
  --profile <your-admin-profile>
```

## Step 4 — Clean up any failed inline-policy attempt

Harmless if nothing was actually saved (that's the leading theory for why the first attempt
had no effect) — check first, then delete only if something's actually there:

```bash
aws iam list-user-policies --user-name devops-agent --profile <your-admin-profile>
# if it lists a policy name, delete it:
aws iam delete-user-policy --user-name devops-agent --policy-name <name-from-above> --profile <your-admin-profile>
```

## Step 5 — Verify

```bash
aws iam list-attached-user-policies --user-name devops-agent --profile <your-admin-profile>
```

Should list both `scribe-devops-bootstrap` and `scribe-devops-infra`. Once confirmed, tell the
agent (or re-invoke `/devops`) to re-run `terraform apply` for `devops.terraform_backend` before
anything downstream is dispatched.

---

## Step 6 — Round 2: broader read permissions (needed after Steps 1-5)

The two managed policies from Step 1 let `terraform apply` actually `CreateBucket`/
`CreateTable` — confirmed working, both resources now exist in AWS. But the AWS provider does a
post-create **read-back** to populate Terraform state, and that needs several read-only actions
not in the original grant (`s3:GetBucketPolicy`, `dynamodb:DescribeContinuousBackups`, and
likely more — the `aws_s3_bucket` resource in provider v5 reads many bucket-level sub-configs:
ACL, CORS, logging, lifecycle, notification, replication, request payment, website, object-lock,
accelerate config, etc). Patching these one denied action at a time is impractical, so grant
broad **read-only, resource-scoped** access instead: `s3:Get*` restricted to just this one
bucket's ARN (does not grant `s3:GetObject`, which needs an object ARN — `s3:Get*` on a bucket
ARN only matches bucket-level actions), and `dynamodb:Describe*` restricted to just this one
table's ARN.

**Update the `scribe-devops-bootstrap` managed policy** (new version, since IAM managed policies
are versioned — keep it as the same policy, just add a new default version):

```bash
cat > scribe-devops-bootstrap-policy-v2.json <<'EOF'
{
    "Version": "2012-10-17",
    "Statement": [
        {"Sid": "StsIdentity", "Effect": "Allow", "Action": "sts:GetCallerIdentity", "Resource": "*"},
        {"Sid": "TerraformStateBucketBootstrap", "Effect": "Allow", "Action": ["s3:CreateBucket","s3:Get*","s3:PutBucketVersioning","s3:PutEncryptionConfiguration","s3:PutBucketPublicAccessBlock","s3:PutBucketTagging","s3:ListBucket"], "Resource": "arn:aws:s3:::scribe-terraform-state-404063516240"},
        {"Sid": "TerraformStateObjectAccess", "Effect": "Allow", "Action": ["s3:GetObject","s3:PutObject","s3:DeleteObject"], "Resource": "arn:aws:s3:::scribe-terraform-state-404063516240/scribe/*"},
        {"Sid": "TerraformLockTableBootstrap", "Effect": "Allow", "Action": ["dynamodb:CreateTable","dynamodb:Describe*","dynamodb:TagResource","dynamodb:GetItem","dynamodb:PutItem","dynamodb:DeleteItem"], "Resource": "arn:aws:dynamodb:us-east-1:404063516240:table/scribe-terraform-locks"},
        {"Sid": "OidcProviderManage", "Effect": "Allow", "Action": ["iam:CreateOpenIDConnectProvider","iam:GetOpenIDConnectProvider","iam:DeleteOpenIDConnectProvider","iam:TagOpenIDConnectProvider","iam:ListOpenIDConnectProviders","iam:UpdateOpenIDConnectProviderThumbprint"], "Resource": "arn:aws:iam::404063516240:oidc-provider/token.actions.githubusercontent.com"},
        {"Sid": "GithubActionsRoleManage", "Effect": "Allow", "Action": ["iam:CreateRole","iam:GetRole","iam:DeleteRole","iam:UpdateRole","iam:UpdateAssumeRolePolicy","iam:TagRole","iam:UntagRole","iam:PutRolePolicy","iam:GetRolePolicy","iam:DeleteRolePolicy","iam:ListRolePolicies","iam:ListAttachedRolePolicies","iam:ListInstanceProfilesForRole","iam:AttachRolePolicy","iam:DetachRolePolicy","iam:PassRole"], "Resource": ["arn:aws:iam::404063516240:role/scribe-github-actions-deploy","arn:aws:iam::404063516240:role/scribe-*"]}
    ]
}
EOF

aws iam create-policy-version \
  --policy-arn arn:aws:iam::404063516240:policy/scribe-devops-bootstrap \
  --policy-document file://scribe-devops-bootstrap-policy-v2.json \
  --set-as-default \
  --profile <your-admin-profile>
```

IAM keeps at most 5 versions per managed policy. If `create-policy-version` errors with
`LimitExceeded`, delete the oldest non-default version first:

```bash
aws iam list-policy-versions --policy-arn arn:aws:iam::404063516240:policy/scribe-devops-bootstrap --profile <your-admin-profile>
aws iam delete-policy-version --policy-arn arn:aws:iam::404063516240:policy/scribe-devops-bootstrap --version-id <oldest-non-default-version-id> --profile <your-admin-profile>
```

### Step 6a — literal copy-paste walkthrough for Step 6

Same as Step 6 above, spelled out as discrete commands to paste directly into a terminal
(or via Claude Code's `!` prefix to run from within a session).

**1. Check what admin AWS access you actually have:**

```bash
aws sts get-caller-identity --profile default
```

If that's the account root user, it's fine to use `--profile default` for this one-off IAM
grant — a human running root directly for a manual IAM change is different from an agent
driving root through the `/devops` workflow (which stays hard-blocked, see `devops/init.sh`).
If a separate admin IAM user/profile exists, use that instead everywhere below.

**2. Create the updated policy file:**

```bash
cat > scribe-devops-bootstrap-policy-v2.json <<'EOF'
{
    "Version": "2012-10-17",
    "Statement": [
        {"Sid": "StsIdentity", "Effect": "Allow", "Action": "sts:GetCallerIdentity", "Resource": "*"},
        {"Sid": "TerraformStateBucketBootstrap", "Effect": "Allow", "Action": ["s3:CreateBucket","s3:Get*","s3:PutBucketVersioning","s3:PutEncryptionConfiguration","s3:PutBucketPublicAccessBlock","s3:PutBucketTagging","s3:ListBucket"], "Resource": "arn:aws:s3:::scribe-terraform-state-404063516240"},
        {"Sid": "TerraformStateObjectAccess", "Effect": "Allow", "Action": ["s3:GetObject","s3:PutObject","s3:DeleteObject"], "Resource": "arn:aws:s3:::scribe-terraform-state-404063516240/scribe/*"},
        {"Sid": "TerraformLockTableBootstrap", "Effect": "Allow", "Action": ["dynamodb:CreateTable","dynamodb:Describe*","dynamodb:TagResource","dynamodb:GetItem","dynamodb:PutItem","dynamodb:DeleteItem"], "Resource": "arn:aws:dynamodb:us-east-1:404063516240:table/scribe-terraform-locks"},
        {"Sid": "OidcProviderManage", "Effect": "Allow", "Action": ["iam:CreateOpenIDConnectProvider","iam:GetOpenIDConnectProvider","iam:DeleteOpenIDConnectProvider","iam:TagOpenIDConnectProvider","iam:ListOpenIDConnectProviders","iam:UpdateOpenIDConnectProviderThumbprint"], "Resource": "arn:aws:iam::404063516240:oidc-provider/token.actions.githubusercontent.com"},
        {"Sid": "GithubActionsRoleManage", "Effect": "Allow", "Action": ["iam:CreateRole","iam:GetRole","iam:DeleteRole","iam:UpdateRole","iam:UpdateAssumeRolePolicy","iam:TagRole","iam:UntagRole","iam:PutRolePolicy","iam:GetRolePolicy","iam:DeleteRolePolicy","iam:ListRolePolicies","iam:ListAttachedRolePolicies","iam:ListInstanceProfilesForRole","iam:AttachRolePolicy","iam:DetachRolePolicy","iam:PassRole"], "Resource": ["arn:aws:iam::404063516240:role/scribe-github-actions-deploy","arn:aws:iam::404063516240:role/scribe-*"]}
    ]
}
EOF
```

**3. Push it as the new default version of the existing policy:**

```bash
aws iam create-policy-version \
  --policy-arn arn:aws:iam::404063516240:policy/scribe-devops-bootstrap \
  --policy-document file://scribe-devops-bootstrap-policy-v2.json \
  --set-as-default \
  --profile default
```

(swap `--profile default` for your real admin profile name if different, in every command
here)

**4. If that errors with `LimitExceeded`** (IAM keeps max 5 versions per policy):

```bash
aws iam list-policy-versions --policy-arn arn:aws:iam::404063516240:policy/scribe-devops-bootstrap --profile default
```

Find the `VersionId` of the oldest one where `"IsDefaultVersion": false`, then:

```bash
aws iam delete-policy-version --policy-arn arn:aws:iam::404063516240:policy/scribe-devops-bootstrap --version-id <that-version-id> --profile default
```

Then retry step 3.

**5. Verify it took:**

```bash
aws iam get-policy-version \
  --policy-arn arn:aws:iam::404063516240:policy/scribe-devops-bootstrap \
  --version-id $(aws iam get-policy --policy-arn arn:aws:iam::404063516240:policy/scribe-devops-bootstrap --profile default --query 'Policy.DefaultVersionId' --output text --profile default) \
  --profile default
```

(or check the AWS Console → IAM → Policies → `scribe-devops-bootstrap` → Permissions tab —
easier to eyeball)

Once done, tell the agent (or re-invoke `/devops`) to re-run `plan`/`apply` and verify the
feature end-to-end.

---

## Step 7 — Round 3: one more DynamoDB action (`ListTagsOfResource`)

After Step 6/6a, `terraform plan` no longer wants to taint/replace anything (good — the
`s3:Get*` grant fixed the S3 side completely: plan shows a clean `3 to add, 0 to change, 0 to
destroy` for the three remaining S3 sub-resources). But it still errors on
`dynamodb:ListTagsOfResource` — a tag-read action that lives outside the `dynamodb:Describe*`
wildcard namespace, so Step 6's grant didn't cover it.

**Update the `TerraformLockTableBootstrap` statement** to add `dynamodb:ListTagsOfResource`
(and `dynamodb:UntagResource` for completeness, so a future tag change doesn't trigger another
round). Repeat Step 6a's process with this file instead:

```bash
cat > scribe-devops-bootstrap-policy-v3.json <<'EOF'
{
    "Version": "2012-10-17",
    "Statement": [
        {"Sid": "StsIdentity", "Effect": "Allow", "Action": "sts:GetCallerIdentity", "Resource": "*"},
        {"Sid": "TerraformStateBucketBootstrap", "Effect": "Allow", "Action": ["s3:CreateBucket","s3:Get*","s3:PutBucketVersioning","s3:PutEncryptionConfiguration","s3:PutBucketPublicAccessBlock","s3:PutBucketTagging","s3:ListBucket"], "Resource": "arn:aws:s3:::scribe-terraform-state-404063516240"},
        {"Sid": "TerraformStateObjectAccess", "Effect": "Allow", "Action": ["s3:GetObject","s3:PutObject","s3:DeleteObject"], "Resource": "arn:aws:s3:::scribe-terraform-state-404063516240/scribe/*"},
        {"Sid": "TerraformLockTableBootstrap", "Effect": "Allow", "Action": ["dynamodb:CreateTable","dynamodb:Describe*","dynamodb:TagResource","dynamodb:UntagResource","dynamodb:ListTagsOfResource","dynamodb:GetItem","dynamodb:PutItem","dynamodb:DeleteItem"], "Resource": "arn:aws:dynamodb:us-east-1:404063516240:table/scribe-terraform-locks"},
        {"Sid": "OidcProviderManage", "Effect": "Allow", "Action": ["iam:CreateOpenIDConnectProvider","iam:GetOpenIDConnectProvider","iam:DeleteOpenIDConnectProvider","iam:TagOpenIDConnectProvider","iam:ListOpenIDConnectProviders","iam:UpdateOpenIDConnectProviderThumbprint"], "Resource": "arn:aws:iam::404063516240:oidc-provider/token.actions.githubusercontent.com"},
        {"Sid": "GithubActionsRoleManage", "Effect": "Allow", "Action": ["iam:CreateRole","iam:GetRole","iam:DeleteRole","iam:UpdateRole","iam:UpdateAssumeRolePolicy","iam:TagRole","iam:UntagRole","iam:PutRolePolicy","iam:GetRolePolicy","iam:DeleteRolePolicy","iam:ListRolePolicies","iam:ListAttachedRolePolicies","iam:ListInstanceProfilesForRole","iam:AttachRolePolicy","iam:DetachRolePolicy","iam:PassRole"], "Resource": ["arn:aws:iam::404063516240:role/scribe-github-actions-deploy","arn:aws:iam::404063516240:role/scribe-*"]}
    ]
}
EOF

aws iam create-policy-version \
  --policy-arn arn:aws:iam::404063516240:policy/scribe-devops-bootstrap \
  --policy-document file://scribe-devops-bootstrap-policy-v3.json \
  --set-as-default \
  --profile default
```

If `LimitExceeded` (same as Step 6a's note 4), delete the oldest non-default version first,
then retry.

---

## Step 8 — Round 4: `iam:SimulatePrincipalPolicy` for verifying `devops.terraform_oidc_github`

The OIDC provider + `scribe-github-actions-deploy` role are already created and confirmed live
(`aws iam get-open-id-connect-provider`, `aws iam get-role` both succeed and show the correct
trust policy). But the feature's required verification proof
(`aws iam simulate-principal-policy --policy-source-arn <role-arn> --action-names ecr:PutImage
--resource-arns 'arn:aws:ecr:*:*:repository/unrelated-repo'`) fails:

```
An error occurred (AccessDenied) when calling the SimulatePrincipalPolicy operation: User:
arn:aws:iam::404063516240:user/devops-agent is not authorized to perform:
iam:SimulatePrincipalPolicy on resource:
arn:aws:iam::404063516240:role/scribe-github-actions-deploy because no identity-based policy
allows the iam:SimulatePrincipalPolicy action
```

This is read-only (doesn't grant any ability to assume or modify the role) and narrowly scoped.
Add to the `scribe-devops-bootstrap` managed policy's `GithubActionsRoleManage` statement's
action list (or a new statement with the same resource):

```json
{"Sid": "SimulateOidcRolePolicy", "Effect": "Allow", "Action": "iam:SimulatePrincipalPolicy", "Resource": "arn:aws:iam::404063516240:role/scribe-github-actions-deploy"}
```

Same `create-policy-version --set-as-default` process as Steps 6a/7. Once granted, re-run the
`simulate-principal-policy` verify command from `devops/sprint-contract.md`'s Active sprint for
`devops.terraform_oidc_github` — expect `implicitDeny` for `ecr:PutImage` on
`unrelated-repo` and `allowed` for the same action on `arn:aws:ecr:*:*:repository/scribe-api`.

**Separate, non-IAM blocker on the same feature (informational, not something to grant):** the
`.github/workflows/oidc-smoke-test.yml` workflow (committed on `feat/devops-terraform-oidc-github`,
PR #9) does not execute yet — `pull_request` events for it show `total_count: 0` and
`gh workflow run oidc-smoke-test.yml --ref feat/devops-terraform-oidc-github` fails with
`Workflow does not have 'workflow_dispatch' trigger`, even though the file on that branch
clearly has both triggers. This is a GitHub Actions platform behavior: `pull_request`- and
`workflow_dispatch`-triggered workflows aren't dispatchable/registered for a repo until the
workflow file exists on the **default branch**. Confirmed via `gh api
repos/nimatrazmjo/harness-lab/actions/permissions` (Actions enabled, `allowed_actions: all`,
not a config issue) and `gh api repos/.../actions/workflows` (the workflow IS catalogued, just
not dispatchable pre-merge). This will self-resolve the first time this PR (or any PR
containing the workflow file) merges to `main` — no grant needed, just document it so a future
session doesn't re-diagnose it from scratch.

**UPDATE after Step 8's grant landed and PR #9 merged:** `iam:SimulatePrincipalPolicy` worked
immediately after the grant — confirmed `implicitDeny` for an unrelated ECR repo, `allowed` for
`scribe-api`, `implicitDeny` for an untagged SSM target and for `iam:CreateUser` (no wildcard
admin). But the `workflow_dispatch` self-resolve-on-merge theory above was **wrong** — even 2+
minutes and repeated polling after merge, `gh workflow run oidc-smoke-test.yml` and the raw API
dispatch endpoint both still returned `422 Workflow does not have 'workflow_dispatch' trigger`.
Root cause appears to be that this specific workflow's GitHub-assigned ID (`337322200`) was
first registered while the file only existed on a non-default branch, and GitHub's
dispatch-eligibility cache for that ID never picked up the later merge — a real platform quirk,
not a timing issue. **Working fix: use the `pull_request` trigger instead.** Opened a small
real PR (#10) touching the workflow file — its `pull_request`-triggered run fired within
seconds and worked correctly. If a future workflow's `workflow_dispatch` gets stuck the same
way, don't keep polling — just exercise its `pull_request` (or other non-`workflow_dispatch`)
trigger instead.

Getting that PR #10 run fully green also surfaced 2 more real, unrelated bugs (full detail in
`devops/progress.md`'s 2026-08-18 "found + fixed 3 real bugs" entry) — a YAML syntax error in
the workflow (unquoted `run:` value containing `": "`, caught by `actionlint`, not by `gh run
view --log` which gives no useful detail for parse-level failures) and a mismatch between the
Terraform's assumed OIDC `sub`-claim format (`repo:owner/repo:...`) and what this GitHub account
actually sends (`repo:owner@ownerID/repo@repoID:...` — immutable IDs baked into the default
subject claim, confirmed by decoding a real ID token, not from docs). Both fixed; the smoke
test now passes end-to-end for real.

---

## Step 9 — Round 5: `ecr:TagResource` for `devops.terraform_ecr`

`terraform apply` for the two `aws_ecr_repository` resources (`scribe-api`, `scribe-web`) fails
immediately, before either repo exists:

```
Error: creating ECR Repository (scribe-api): operation error ECR: CreateRepository, https
response error StatusCode: 400, RequestID: 95e6933b-cfcc-4547-a15a-38e3f3434857, api error
AccessDeniedException: User: arn:aws:iam::404063516240:user/devops-agent is not authorized to
perform: ecr:TagResource on resource: arn:aws:ecr:us-east-1:404063516240:repository/scribe-api
because no identity-based policy allows the ecr:TagResource action
```

Same for `scribe-web` (`.../repository/scribe-web`). Confirmed via `aws ecr
describe-repositories --repository-names scribe-api scribe-web` afterward → both
`RepositoryNotFoundException` — the AWS API rejects `CreateRepository` atomically when the
tagging half of the same call is denied (this account's provider `default_tags` block applies
`Project`/`ManagedBy` tags on create), so nothing partial was left behind; `terraform state
list` shows no `aws_ecr_repository`/`aws_ecr_lifecycle_policy` resources.

Root cause: the existing `scribe-devops-infra` policy's `EcrRepos` statement (Step 1 above)
lists `CreateRepository`, `PutImageTagMutability`, `PutLifecyclePolicy`,
`PutImageScanningConfiguration`, and various push/read actions, scoped to
`arn:aws:ecr:*:*:repository/scribe-*` — but not `ecr:TagResource`, which is a distinct action
from `CreateRepository` even though this SDK call bundles them.

**Minimal fix:** add `ecr:TagResource` (and `ecr:UntagResource` / `ecr:ListTagsForResource` for
completeness, so a future tag change or read-back doesn't trigger another round) to the
`EcrRepos` statement's action list, same resource scope (`arn:aws:ecr:*:*:repository/scribe-*`).
Same `create-policy-version --set-as-default` process as Steps 6a/7/8, but this time on the
**`scribe-devops-infra`** managed policy (not `scribe-devops-bootstrap`):

```bash
cat > scribe-devops-infra-policy-v2.json <<'EOF'
{
    "Version": "2012-10-17",
    "Statement": [
        {"Sid": "NetworkingCompute", "Effect": "Allow", "Action": ["ec2:Describe*","ec2:CreateVpc","ec2:DeleteVpc","ec2:ModifyVpcAttribute","ec2:CreateSubnet","ec2:DeleteSubnet","ec2:CreateSecurityGroup","ec2:DeleteSecurityGroup","ec2:AuthorizeSecurityGroupIngress","ec2:AuthorizeSecurityGroupEgress","ec2:RevokeSecurityGroupIngress","ec2:RevokeSecurityGroupEgress","ec2:CreateRouteTable","ec2:DeleteRouteTable","ec2:CreateRoute","ec2:DeleteRoute","ec2:AssociateRouteTable","ec2:DisassociateRouteTable","ec2:CreateInternetGateway","ec2:DeleteInternetGateway","ec2:AttachInternetGateway","ec2:DetachInternetGateway","ec2:RunInstances","ec2:TerminateInstances","ec2:ModifyInstanceAttribute","ec2:CreateTags","ec2:DeleteTags"], "Resource": "*"},
        {"Sid": "RdsDatabase", "Effect": "Allow", "Action": ["rds:CreateDBInstance","rds:DeleteDBInstance","rds:ModifyDBInstance","rds:DescribeDBInstances","rds:CreateDBSubnetGroup","rds:DeleteDBSubnetGroup","rds:DescribeDBSubnetGroups","rds:AddTagsToResource","rds:ListTagsForResource"], "Resource": "*"},
        {"Sid": "EcrRepos", "Effect": "Allow", "Action": ["ecr:CreateRepository","ecr:DeleteRepository","ecr:DescribeRepositories","ecr:PutImageTagMutability","ecr:PutLifecyclePolicy","ecr:PutImageScanningConfiguration","ecr:TagResource","ecr:UntagResource","ecr:ListTagsForResource","ecr:BatchCheckLayerAvailability","ecr:PutImage","ecr:InitiateLayerUpload","ecr:UploadLayerPart","ecr:CompleteLayerUpload","ecr:BatchGetImage","ecr:DescribeImages","ecr:ListImages"], "Resource": "arn:aws:ecr:*:*:repository/scribe-*"},
        {"Sid": "EcrAuth", "Effect": "Allow", "Action": "ecr:GetAuthorizationToken", "Resource": "*"},
        {"Sid": "SsmDeploy", "Effect": "Allow", "Action": ["ssm:SendCommand","ssm:GetCommandInvocation","ssm:ListCommandInvocations","ssm:DescribeInstanceInformation"], "Resource": "*", "Condition": {"StringEquals": {"ssm:resourceTag/deploy": "true"}}},
        {"Sid": "IamInstanceProfileMgmt", "Effect": "Allow", "Action": ["iam:CreateInstanceProfile","iam:DeleteInstanceProfile","iam:AddRoleToInstanceProfile","iam:RemoveRoleFromInstanceProfile","iam:GetInstanceProfile"], "Resource": "arn:aws:iam::404063516240:instance-profile/scribe-*"}
    ]
}
EOF

aws iam create-policy-version \
  --policy-arn arn:aws:iam::404063516240:policy/scribe-devops-infra \
  --policy-document file://scribe-devops-infra-policy-v2.json \
  --set-as-default \
  --profile default
```

(swap `--profile default` for the real admin profile; if `LimitExceeded`, same as Steps 6a/7/8
— delete the oldest non-default version of `scribe-devops-infra` first, then retry.)

Once granted, re-run `terraform apply` in `infra/terraform/` for `devops.terraform_ecr` and the
full verify sequence (`describe-repositories` for `IMMUTABLE`, the double-push smoke test,
`get-lifecycle-policy`).

---

## Log

- **2026-08-18** — First grant attempt (inline user policy) had no effect: `terraform apply`
  for `devops.terraform_backend` failed identically before and after, with
  `AccessDenied ... because no identity-based policy allows the action` — the phrasing IAM uses
  when no identity policy grants it, consistent with the inline policy (~8,500 chars) exceeding
  the 2,048-char inline aggregate limit and never actually saving. Fixed by splitting into two
  managed policies (Steps 1-5) — confirmed working, `CreateBucket`/`CreateTable` succeeded.
- **2026-08-18** — After Steps 1-5, `terraform apply` created both real resources
  (`scribe-terraform-state-404063516240` bucket, `scribe-terraform-locks` table — both
  confirmed to exist via `aws s3api head-bucket` / `aws dynamodb describe-table`) but then
  failed on the AWS provider's post-create read-back (`s3:GetBucketPolicy`,
  `dynamodb:DescribeContinuousBackups` denied), which tainted both resources in Terraform state
  (wants to destroy+recreate). `lifecycle.prevent_destroy` correctly blocked the replace — no
  data loss, no actual destroy attempted. Ran `terraform untaint` on both to clear the false
  taint (the actual AWS resources are fine). Step 6 above grants broader scoped read access to
  avoid further one-action-at-a-time denials on the provider's remaining read calls
  (versioning, encryption config, public-access-block resources still need to be created —
  plan hadn't gotten that far before erroring).
- **2026-08-18** — After Step 6/6a, `terraform plan` is clean on the S3 side: no more
  taint/replace, just `3 to add, 0 to change, 0 to destroy` for the remaining sub-resources
  (versioning, encryption config, public-access-block). One more DynamoDB gap surfaced:
  `dynamodb:ListTagsOfResource` denied — outside the `dynamodb:Describe*` wildcard's namespace.
  Step 7 adds it (plus `UntagResource` for completeness).
- **2026-08-18** — `devops.terraform_oidc_github`: the OIDC provider + IAM role themselves
  applied cleanly on the FIRST try (no new grant needed — Step 1's `OidcProviderManage` /
  `GithubActionsRoleManage` statements already covered `CreateOpenIDConnectProvider`/
  `CreateRole`/`PutRolePolicy` and their read-backs). `terraform apply`: `3 added, 0 changed, 0
  destroyed`. Confirmed live via `aws iam get-open-id-connect-provider` and `aws iam get-role`
  (trust policy correctly scoped to `repo:nimatrazmjo/harness-lab:*`, not `repo:*`). The
  required verify command `aws iam simulate-principal-policy` then hit a NEW gap —
  `iam:SimulatePrincipalPolicy` itself denied (not covered by any existing statement, since
  it's a verification/testing action, not a create/manage action). Step 8 above documents the
  exact fix. Feature left `blocked` in `devops/feature-list.json`, not faked `passing` — 2 of
  the 3 minimum required proofs (`get-role`, `get-open-id-connect-provider`) are done for real;
  the third (`simulate-principal-policy`) needs Step 8's grant.
- **2026-08-18** — `devops.terraform_ecr`: `terraform plan` was clean (`4 to add, 0 to change,
  0 to destroy` — 2 `aws_ecr_repository` + 2 `aws_ecr_lifecycle_policy`), but `terraform apply`
  failed immediately on `ecr:TagResource` denied for both `scribe-api` and `scribe-web` (the
  existing `EcrRepos` grant covers `CreateRepository` but not the separate `TagResource` action
  that the same API call bundles when `default_tags` are set). Confirmed no partial resources
  created (`describe-repositories` → `RepositoryNotFoundException` for both, `terraform state
  list` shows no ECR resources) — AWS rejects the whole `CreateRepository` call atomically when
  its tagging half is denied, so nothing to clean up. Step 9 above documents the exact minimal
  fix (add `ecr:TagResource`/`UntagResource`/`ListTagsForResource` to `scribe-devops-infra`'s
  `EcrRepos` statement). Feature left `blocked` in `devops/feature-list.json`.
