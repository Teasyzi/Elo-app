package br.com.eloapp;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(EloAvatarPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
