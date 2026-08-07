ALTER TABLE "ByodStudySession"
ADD COLUMN "eligibility" JSONB NOT NULL DEFAULT '{"scope":"CLASS","allowedPlatforms":["ANDROID","CHROMEOS","IOS","MACOS","WINDOWS"],"allowedBrowsers":["CHROME","EDGE","SAFARI"],"minimumBrowserMajorVersion":100}';
