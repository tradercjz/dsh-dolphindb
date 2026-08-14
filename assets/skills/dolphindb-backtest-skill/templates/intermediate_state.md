# Intermediate State Template

Use this compact state block in the conversation when a strategy may need later refinement. Do not write it to disk unless the user asks.

```json
{
  "requirements": {
    "strategy_understanding": "",
    "assumptions": [],
    "unresolved_questions": []
  },
  "config": {
    "assetCategory": "stock",
    "config_ref": "refs/config_complete/stock.jsonl",
    "strategyGroup": "stock",
    "dataType": 4,
    "frequency": "daily",
    "startDate": "",
    "endDate": "",
    "initialCash": null,
    "tradingLogic": {
      "buy": "",
      "sell": ""
    }
  },
  "datasource": {
    "status": "",
    "selected_tables": [],
    "signal_schema": {
      "size": 0,
      "columns": []
    },
    "used_functions": [],
    "datasource_constraints": []
  },
  "initialize": {
    "planning_status": "",
    "generation_status": "",
    "datasource_signals": [],
    "initialize_indicators": [],
    "context": []
  },
  "callback": {
    "planning_status": "",
    "generation_status": "",
    "callbacks": [],
    "reads": {
      "context_fields": [],
      "datasource_signal_reads": [],
      "initialize_indicator_reads": []
    }
  },
  "dependency_gaps": {
    "missing_initialize_indicators": []
  },
  "revision_history": [],
  "runtime_artifacts": [],
  "final_assembly_ready": false
}
```

Set `final_assembly_ready=true` only when datasource, initialize, and callback generation are all `completed` and no dependency gaps remain.
