rg -n "const safePage =|const safeLimit =" functions/repositories functions/services
rg -n "_parseJson\(|JSON\.parse\(" functions/repositories functions/services functions/lib/hono/routes
rg -n "variant_primary_image_id|display_image_id" functions/repositories/SpaceRepository.js
rg -n "Date\.now\(\)|(?<!Date\.)\bnow\(\)" -P functions
rg -n "crypto\.randomUUID\(" functions/repositories functions/api/cron
rg -n "result\.meta\?\.changes" functions
