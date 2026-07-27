# Cloudflare R2 media storage

Production catalog images are stored in a private-to-write R2 bucket and delivered through a public custom domain. Browser uploads still go through `media-service`; R2 credentials are never exposed to the frontend.

## Cloudflare setup

1. Create the dedicated `astro` bucket.
2. Create an Account API token restricted to that bucket with **Object Read & Write** permission. Record its S3 access key ID and secret access key.
3. Connect `astro-img.shuumatsu.org` to the bucket. The zone and bucket must belong to the same Cloudflare account.
4. Disable the public `r2.dev` URL after the custom domain works.
5. Apply a bucket CORS policy for the production and staging sites. Only `GET` and `HEAD` are required because uploads use `media-service`.

```json
[
  {
    "AllowedOrigins": [
      "https://example.com",
      "https://staging.example.com"
    ],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": [],
    "ExposeHeaders": ["Content-Length", "Content-Type", "ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Purge the custom-domain cache after changing CORS. Configure a Cache Rule for JPEG, PNG, and WebP responses so Cloudflare honors the object's `Cache-Control: public, max-age=31536000, immutable` header.

## Production configuration

The services read a dotenv-style configuration file themselves before Spring Boot starts. On the production server, copy [`production.env.example`](production.env.example) to `deploy/compose/.env.production`, then fill in the real values. Starting from the repository root, or either service directory, automatically finds that file. No PowerShell environment-variable import is required.

The file may contain ordinary `KEY=value` lines, optional `export ` prefixes, and quoted values. An already-set JVM system property or operating-system environment variable still takes priority, which keeps container deployment overrides possible. `deploy/compose/.env.r2` remains a backwards-compatible fallback for existing local setups.

The actual `.env.production` file is ignored by Git. Commit only the template and never commit credentials.

```dotenv
MEDIA_S3_ENDPOINT=https://26d627d3f106a8d504ec94827413d086.r2.cloudflarestorage.com
MEDIA_S3_REGION=auto
MEDIA_S3_ACCESS_KEY=R2_ACCESS_KEY_ID
MEDIA_S3_SECRET_KEY=R2_SECRET_ACCESS_KEY
MEDIA_S3_BUCKET=astro
MEDIA_S3_PATH_STYLE=true
MEDIA_S3_AUTO_CREATE_BUCKET=false
MEDIA_DELIVERY_MODE=direct
MEDIA_PUBLIC_BASE_URL=https://astro-img.shuumatsu.org
```

`MEDIA_PUBLIC_BASE_URL` must be supplied to both `media-service` and `content-service`. In direct mode, compatibility requests to `/api/media/assets/{mediaId}` receive a cacheable one-hour redirect to the custom domain.

To use a configuration file outside the repository, set `ASTRO_ENV_FILE` to its absolute path; `ASTRO_LOCAL_ENV_FILE` is also supported for compatibility.

## Deployment smoke test

1. Start with `MEDIA_DELIVERY_MODE=proxy` and upload a small test image through the admin UI.
2. Confirm that R2 contains an object whose key matches the returned `mediaId`.
3. Request the object through the custom domain and verify status `200`, its MIME type, and the immutable cache header.
4. Load the admin preview and public catalog from every allowed origin and confirm there are no CORS errors.
5. Switch to `MEDIA_DELIVERY_MODE=direct`, then confirm old `/api/media/assets/{mediaId}` links return `302` without exposing the endpoint or credentials.

References: [R2 S3 API](https://developers.cloudflare.com/r2/api/s3/api/), [AWS SDK for Java example](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-java/), [public buckets and custom domains](https://developers.cloudflare.com/r2/buckets/public-buckets/), [CORS](https://developers.cloudflare.com/r2/buckets/cors/), and [API tokens](https://developers.cloudflare.com/r2/api/tokens/).
