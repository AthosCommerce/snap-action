# Snap Github Action

This action publishes a [Snap](https://github.com/searchspring/snap) implementation bundle to AWS S3. This is only applicable if the repository is hosted within the [snap-implementations](https://github.com/snap-implementations) Github organization. Otherwise, the action will skip deployment to S3 and only run build and run tests.

# Usage

Since Github does not support private actions and this repository is private at the moment, you must first use `actions/checkout@v2` to clone this repository by using a Personal Access Token, then execute the `action.yml` file

Here is a workflow example:

```yaml
on: [push]

jobs:
  Publish:
    runs-on: ubuntu-latest
    name: Snap Action
    steps:
      - name: checkout action
        uses: actions/checkout@v2
        with:
          repository: searchspring/snap-publish
      - name: Run @searchspring/snap-publish action
        uses: ./
        with:
        # required
          repository: ${{ env.GITHUB_REPOSITORY }}
        # optional
          secretKey: ${{ secrets.WEBSITE_SECRET_KEY }}
          secrets: ${{ toJSON(secrets) }}
          aws-access-key-id: ${{ secrets.SNAPFU_AWS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.SNAPFU_AWS_SECRET_ACCESS_KEY }}
          aws-cloudfront-distribution-id: ${{secrets.SNAPFU_AWS_DISTRIBUTION_ID}}
          aws-s3-bucket-name: ${{secrets.SNAPFU_AWS_BUCKET}}
          aws-region: us-east-2
          NODE_AUTH_TOKEN: ${{ secrets.PACKAGE_TOKEN }}
          GITHUB_BOT_TOKEN: ${{ secrets.MACHINE_TOKEN }}
          LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}
          skipTests: false
          skipLighthouse: false
          skipPublish: false
          skipInvalidation: false
```

## Inputs

### repository
The `repository` input parameter is **required**. This is the repository that will be cloned. For example, if your repository is `https://github.com/snap-implementations/demo.shopify`, you would specify: 

```yaml
with:
    repository: snap-implementations/demo.shopify
```

However if the action will be invoked from the same repository as the implementation, `${{ env.GITHUB_REPOSITORY }}` can be used. 

### secretKey
The `secretKey` input parameter is only required if the `searchspring.siteId` (or `athos.siteId`) property of the project's package.json file is a string. This is used to authenticate the project's siteId (specified in the package.json `searchspring.siteId` or `athos.siteId`) with the Searchspring or Athos Commerce account. The `secretKey` value can be found in the [Searchspring Management Console](https://manage.searchspring.net/) or [Athos Commerce Console](https://console.athoscommerce.net/)

If your project was created via [snapfu](https://github.com/searchspring/snapfu), you may have already specified a secret key and the repository will contain the secret `WEBSITE_SECRET_KEY` available to be used as the `secretKey` in your workflow.

```yaml
with:
    secretKey: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### aws-access-key-id
The `aws-access-key-id` input parameter is only required if the action is being used with repositories in the [snap-implementations](https://github.com/snap-implementations) Github organization.

### aws-secret-access-key
The `aws-secret-access-key` input parameter is only required if the action is being used with repositories in the [snap-implementations](https://github.com/snap-implementations) Github organization.

### aws-cloudfront-distribution-id
The `aws-cloudfront-distribution-id` input parameter is only required if the action is being used with repositories in the [snap-implementations](https://github.com/snap-implementations) Github organization.

### aws-s3-bucket-name
The `aws-s3-bucket-name` input parameter is only required if the action is being used with repositories in the [snap-implementations](https://github.com/snap-implementations) Github organization.

---

### The following parameters are **optional**

### aws-region
The `aws-s3-bucket-name` input parameter is optional and is not used unless the action is being used with repositories in the [snap-implementations](https://github.com/snap-implementations) Github organization. The default region if not specified is `us-east-2`

### NODE_AUTH_TOKEN
The `NODE_AUTH_TOKEN` input parameter is optional. It allows for installation of private packages that require a token to authenticate when `npm install` is invoked. 

### GITHUB_BOT_TOKEN
The `GITHUB_BOT_TOKEN` input parameter is optional. Actions triggered on pull requests will run lighthouse testing and the scores will be posted in a pull request comment by the user "github-actions". To change this user, set `GITHUB_BOT_TOKEN` to a Github PAT of the desired user account.

The `GITHUB_BOT_TOKEN` input parameter is also used for pushing tags and is required if tag protection rules are setup on the repository.

### LHCI_GITHUB_APP_TOKEN
The `LHCI_GITHUB_APP_TOKEN` input parameter is optional. This is passed along to lighthouse and if set the reports will be uploaded to a remote server (requires `lighthouserc.js` file in implementation repo to contain valid `ci.upload.target` config). Additionally, if the organization has contains the [Lighthouse CI Github App](https://github.com/apps/lighthouse-ci) installed, setting `LHCI_GITHUB_APP_TOKEN` will also trigger this app to post a status check to the pull request. 

Note: setting `LHCI_GITHUB_APP_TOKEN` will disable posting a pull request comment with lighthouse scores due to `ci.upload.target` no longer containg a value `'filesystem'`

### skipTests
The `skipTests` input parameter is optional. If set to `true`, the action will not run `npm run test` after `npm install`

### skipLighthouse
The `skipLighthouse` input parameter is optional. If set to `true`, the action will not run any lighthouse tests.

### skipPublish
The `skipPublish` input parameter is optional. If set to `true`, the action will not publish to the CDN.

### skipInvalidation
The `skipInvalidation` input parameter is optional. If set to `true`, the action will invalidate the CDN.

### secrets
The `secrets` input parameter is only required if the `searchspring.siteId` (or `athos.siteId`) property of the project's package.json file is an object.

For example: 
```json
{
  "searchspring": {
    "siteId": {
      "abc123": {
        "name": "website.com"
      },
      "def456": {
        "name": "website.com.au"
      }
    }
  }
}
```

or

```json
{
  "athos": {
    "siteId": {
      "at1234": {
        "name": "example.com"
      },
      "at5678": {
        "name": "example.com.au"
      }
    }
  }
}
```

When `searchspring.siteId` (or `athos.siteId`) is an object, it allows multiple siteIds to be specified. A repository secret for each siteId must exist in the `WEBSITE_SECRET_KEY_${siteId}` format and contain the `secretKey` value found in the [Searchspring Management Console](https://manage.searchspring.net/) or [Athos Commerce Console](https://console.athoscommerce.net/)

For the example above `WEBSITE_SECRET_KEY_ABC123` and `WEBSITE_SECRET_KEY_DEF456` must exist. 

When using `secrets`, it is expected to be encoded using `toJSON`

```yml
with:
  secrets: ${{ toJSON(secrets) }}
```
