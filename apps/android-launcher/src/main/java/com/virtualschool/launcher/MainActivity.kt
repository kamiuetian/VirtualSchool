package com.virtualschool.launcher

import android.app.Activity
import android.os.Bundle
import android.widget.TextView

class MainActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val view = TextView(this).apply {
            text = "Virtual School Launcher\nMode: Default School"
            textSize = 22f
            setPadding(32, 32, 32, 32)
        }

        setContentView(view)
    }
}
