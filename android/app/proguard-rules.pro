# NativeBridge uses the origin-scoped WebKit message API, not reflective JS interfaces.
# Play Billing, UMP, WebKit and Mobile Ads supply their own consumer rules.
-keepattributes Signature,InnerClasses,EnclosingMethod
