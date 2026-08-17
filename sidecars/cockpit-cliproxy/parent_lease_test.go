package main

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestParentLeaseKeepsSidecarAliveDuringUnexpiredHandoff(t *testing.T) {
	now := time.UnixMilli(1_000_000)
	tracker := &parentLeaseTracker{ownerPID: 101}
	processChecked := false

	decision := tracker.evaluate(parentProcessLease{
		Version:   parentLeaseVersion,
		OwnerPID:  101,
		State:     parentLeaseStateHandoff,
		ExpiresAt: now.Add(time.Second).UnixMilli(),
	}, now, func(int) bool {
		processChecked = true
		return false
	})

	if decision.exit {
		t.Fatal("unexpired handoff should keep the sidecar alive")
	}
	if processChecked {
		t.Fatal("handoff must not depend on the old owner process remaining alive")
	}
}

func TestParentLeaseExitsWhenHandoffExpiresWithoutAdoption(t *testing.T) {
	now := time.UnixMilli(1_000_000)
	tracker := &parentLeaseTracker{ownerPID: 101}

	decision := tracker.evaluate(parentProcessLease{
		Version:   parentLeaseVersion,
		OwnerPID:  101,
		State:     parentLeaseStateHandoff,
		ExpiresAt: now.UnixMilli(),
	}, now, func(int) bool { return true })

	if !decision.exit || decision.reason != "parent_handoff_expired" {
		t.Fatalf("expired handoff decision = %+v, want parent_handoff_expired", decision)
	}
}

func TestParentLeaseAdoptsChangedActiveOwnerAndMonitorsIt(t *testing.T) {
	now := time.UnixMilli(1_000_000)
	tracker := &parentLeaseTracker{ownerPID: 101}
	lease := parentProcessLease{
		Version:  parentLeaseVersion,
		OwnerPID: 202,
		State:    parentLeaseStateActive,
	}

	decision := tracker.evaluate(lease, now, func(pid int) bool { return pid == 202 })
	if decision.exit || !decision.adopted || tracker.ownerPID != 202 {
		t.Fatalf("adoption decision = %+v, tracked owner = %d", decision, tracker.ownerPID)
	}

	decision = tracker.evaluate(lease, now, func(int) bool { return false })
	if !decision.exit || decision.ownerPID != 202 || decision.reason != "parent_lease_owner_exit" {
		t.Fatalf("dead adopted owner decision = %+v", decision)
	}
}

func TestReadParentProcessLeaseUsesCamelCaseSchema(t *testing.T) {
	path := filepath.Join(t.TempDir(), "parent-lease.json")
	data := []byte(`{"version":1,"ownerPid":321,"state":"handoff","expiresAt":987654321}`)
	if err := os.WriteFile(path, data, 0o600); err != nil {
		t.Fatal(err)
	}

	lease, err := readParentProcessLease(path)
	if err != nil {
		t.Fatal(err)
	}
	if lease.Version != 1 || lease.OwnerPID != 321 || lease.State != "handoff" || lease.ExpiresAt != 987654321 {
		t.Fatalf("decoded lease = %+v", lease)
	}
}

func TestValidateParentProcessLeaseRejectsInvalidData(t *testing.T) {
	tests := []parentProcessLease{
		{Version: 2, OwnerPID: 1, State: parentLeaseStateActive},
		{Version: 1, OwnerPID: 0, State: parentLeaseStateActive},
		{Version: 1, OwnerPID: 1, State: "unknown"},
		{Version: 1, OwnerPID: 1, State: parentLeaseStateHandoff},
	}
	for _, lease := range tests {
		if err := validateParentProcessLease(lease); err == nil {
			t.Fatalf("validateParentProcessLease(%+v) unexpectedly succeeded", lease)
		}
	}
}
