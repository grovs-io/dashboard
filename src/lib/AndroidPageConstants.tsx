/** Gradle Kotlin DSL dependency line for the Android SDK. */
export const androidGradleDependency = (version?: string | null) =>
  `implementation("io.grovs:Grovs:${version ?? "LATEST_VERSION"}")`;

export const sdkAndroidValue = `import io.grovs.Grovs
class MainApplication : Application() {

  override fun onCreate() {
    super.onCreate()
    Grovs.configure(this, "_GROVS_API_KEY_", useTestEnvironment = false)
  }
}
`;

export const googleCloudScript = `chmod +x grovs_android_gcloud_setup.sh
./grovs_android_gcloud_setup.sh`;

export const sdkLauncherActivityValue = `import io.grovs.Grovs
class MainActivity : ComponentActivity() {
  override fun onStart() {
    super.onStart()
    Grovs.onStart()
  }
    override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)

    Grovs.onNewIntent(intent)
  }
}
`;
export const sdkHandleDeepLinksValue = `// Listen for open from link events using listeners

Grovs.setOnDeeplinkReceivedListener(this) {
  link, payload ->
  val message = "Got link from listener: $link payload: $payload"
  Log.d("Grovs", message)
}

// OR

//Listen for open from link events using kotlin coroutines

Grovs.Companion:: openedLinkDetails.flow.collect {
  deeplinkDetails ->
  val message = "Got link from flow: \${deeplinkDetails?.link} payload: 
  \${ deeplinkDetails?.data } "
  Log.d("Grovs", message)
}
`;

export const sdkReactNativeAppValue = `// Once configured, you can utilize the various functionalities provided by Grovs.
import Grovs from 'react-native-grovs-wrapper';

// You can receive deep link events by registering a listener. Here's how you can implement it:
const listener = Grovs.onDeeplinkReceived((data) => {
});

// When you don't want to receive events anymore
listener.remove(); // Stop receiving events


`;

const appLinkFilter = (
  host: string | undefined | null
) => `<intent-filter android:autoVerify="true">
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="https" android:host="${host}" />
</intent-filter>`;

// Scheme filter, then one app-link filter per host (production hosts first, then test).
export const intentFiltersXml = (
  uriScheme: string | undefined,
  hosts: (string | null | undefined)[]
) =>
  [
    `<intent-filter>
  <data android:scheme="${uriScheme ?? "YOUR_URI_SCHEME"}" android:host="open" />
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
</intent-filter>`,
    ...hosts.map(appLinkFilter),
  ].join("\n\n") + "\n";
