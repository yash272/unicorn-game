// macOS QR verification. Usage: scan-qr EXPECTED_URL image.png [image2.png ...]
// clang -fobjc-arc -framework Foundation -framework CoreImage scan-qr.m -o /tmp/scan-qr
#import <Foundation/Foundation.h>
#import <CoreImage/CoreImage.h>

int main(int argc, const char *argv[]) {
  @autoreleasepool {
    if (argc < 3) return 2;
    NSString *expected = [NSString stringWithUTF8String:argv[1]];
    CIDetector *detector = [CIDetector detectorOfType:CIDetectorTypeQRCode context:nil options:@{CIDetectorAccuracy: CIDetectorAccuracyHigh}];
    for (int i=2; i<argc; i++) {
      NSString *path = [NSString stringWithUTF8String:argv[i]];
      CIImage *image = [CIImage imageWithContentsOfURL:[NSURL fileURLWithPath:path]];
      NSArray *features = [detector featuresInImage:image];
      if (features.count != 1) { fprintf(stderr, "Expected one QR: %s\n", argv[i]); return 1; }
      CIQRCodeFeature *qr = features[0];
      if (![qr.messageString isEqualToString:expected]) { fprintf(stderr,"Incorrect QR payload\n"); return 1; }
      printf("PASS %s -> %s\n", argv[i], [qr.messageString UTF8String]);
    }
  }
  return 0;
}
