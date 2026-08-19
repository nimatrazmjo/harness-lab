<!-- GENERATED:feature-graph:BEGIN (do not edit by hand -- run scripts/generate-feature-graph.py) -->

### DevOps workstream — feature dependency graph

_16 features: 2 blocked, 5 failing, 9 passing._

```mermaid
flowchart TD
    subgraph tier0["Tier 0"]
        n_devops_dockerfile_api["devops.dockerfile_api"]
        n_devops_dockerfile_web["devops.dockerfile_web"]
        n_devops_terraform_backend["devops.terraform_backend"]
        n_devops_terraform_oidc_github["devops.terraform_oidc_github"]
        n_devops_terraform_ecr["devops.terraform_ecr"]
        n_devops_terraform_networking_rds["devops.terraform_networking_rds"]
        n_devops_terraform_compute_envs["devops.terraform_compute_envs"]
    end
    subgraph tier1["Tier 1"]
        n_devops_ci_secret_scan["devops.ci_secret_scan"]
        n_devops_ci_build_images["devops.ci_build_images"]
        n_devops_ci_image_scan_trivy["devops.ci_image_scan_trivy"]
    end
    subgraph tier2["Tier 2"]
        n_devops_cd_push_ecr_main["devops.cd_push_ecr_main"]
        n_devops_cd_deploy_prod_on_main["devops.cd_deploy_prod_on_main"]
        n_devops_cd_rollback["devops.cd_rollback"]
        n_devops_cd_manual_dispatch_multi_env["devops.cd_manual_dispatch_multi_env"]
    end
    subgraph tier3["Tier 3"]
        n_devops_deploy_health_gate["devops.deploy_health_gate"]
        n_devops_ci_terraform_plan["devops.ci_terraform_plan"]
    end
    n_devops_terraform_backend --> n_devops_terraform_oidc_github
    n_devops_terraform_backend --> n_devops_terraform_ecr
    n_devops_terraform_oidc_github --> n_devops_terraform_ecr
    n_devops_terraform_backend --> n_devops_terraform_networking_rds
    n_devops_terraform_networking_rds --> n_devops_terraform_compute_envs
    n_devops_dockerfile_api --> n_devops_terraform_compute_envs
    n_devops_dockerfile_web --> n_devops_terraform_compute_envs
    n_devops_dockerfile_api --> n_devops_ci_build_images
    n_devops_dockerfile_web --> n_devops_ci_build_images
    n_devops_ci_build_images --> n_devops_ci_image_scan_trivy
    n_devops_terraform_ecr --> n_devops_cd_push_ecr_main
    n_devops_ci_secret_scan --> n_devops_cd_push_ecr_main
    n_devops_ci_image_scan_trivy --> n_devops_cd_push_ecr_main
    n_devops_cd_push_ecr_main --> n_devops_cd_deploy_prod_on_main
    n_devops_terraform_compute_envs --> n_devops_cd_deploy_prod_on_main
    n_devops_cd_deploy_prod_on_main --> n_devops_cd_rollback
    n_devops_cd_push_ecr_main --> n_devops_cd_manual_dispatch_multi_env
    n_devops_terraform_compute_envs --> n_devops_cd_manual_dispatch_multi_env
    n_devops_cd_deploy_prod_on_main --> n_devops_deploy_health_gate
    n_devops_cd_rollback --> n_devops_deploy_health_gate
    n_devops_terraform_backend --> n_devops_ci_terraform_plan
    style n_devops_dockerfile_api fill:#c8e6c9,stroke:#2e7d32
    style n_devops_dockerfile_web fill:#c8e6c9,stroke:#2e7d32
    style n_devops_terraform_backend fill:#c8e6c9,stroke:#2e7d32
    style n_devops_terraform_oidc_github fill:#c8e6c9,stroke:#2e7d32
    style n_devops_terraform_ecr fill:#c8e6c9,stroke:#2e7d32
    style n_devops_terraform_networking_rds fill:#ffcdd2,stroke:#c62828
    style n_devops_terraform_compute_envs fill:#ffcdd2,stroke:#c62828
    style n_devops_ci_secret_scan fill:#c8e6c9,stroke:#2e7d32
    style n_devops_ci_build_images fill:#c8e6c9,stroke:#2e7d32
    style n_devops_ci_image_scan_trivy fill:#c8e6c9,stroke:#2e7d32
    style n_devops_cd_push_ecr_main fill:#c8e6c9,stroke:#2e7d32
    style n_devops_cd_deploy_prod_on_main fill:#eeeeee,stroke:#757575
    style n_devops_cd_rollback fill:#eeeeee,stroke:#757575
    style n_devops_cd_manual_dispatch_multi_env fill:#eeeeee,stroke:#757575
    style n_devops_deploy_health_gate fill:#eeeeee,stroke:#757575
    style n_devops_ci_terraform_plan fill:#eeeeee,stroke:#757575
```

<!-- GENERATED:feature-graph:END -->
