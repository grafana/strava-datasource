# Strava Datasource Configuration

In order to start using Strava datasource you will need to make a Strava API application.

1. After you are logged in, go to https://www.strava.com/settings/api and create an app.
2. You should see the “My API Application” page now. Here is what everything means:
   - Category: The category you chose for your application
   - Club: Will show if you have a club associated with your application
   - Client ID: Your application ID
   - Client Secret: Your client secret (please keep this confidential)
   - Authorization token: Your authorization token which will change every six hours (please keep this confidential)
   - Your Refresh token: The token you will use to get a new authorization token (please keep this confidential)
   - Rate limits: Your current rate limit
   - Authorization Callback Domain: change “Authorization Callback Domain” to localhost or any domain.

Learn more about Strava API applications at [Strava developer docs](https://developers.strava.com/docs/getting-started/#account).

Then go to grafana and create new Strava datasource.

![New Data Source](img/config_1.png)

Fill _Client ID_ field with value obtained from Strava API application page. Click _Connect with Strava_ button and authorize grafana datasource to connect to Strava.

![Authorize datasource](img/config_2.png)

You will be redirected back to the datasource configuration page. Now fill _Client ID_ and _Client Secret_ fields. Finally, set desired data source name and click _Save & Test_ button. If connection is properly configured, you will see _Data source is working_ message.

![Save & Test](img/config_3.png)

Now you can create some dashboards! Also, you can import dashboards from the _Dashboards_ tab at the data source configuration page.
