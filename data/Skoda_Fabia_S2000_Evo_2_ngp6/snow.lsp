(("PhysicsEngine"
  DefManager
  (
   ("Car"
	("CAR_ROOT"
	 SetupSpec						2
	 CarId							1641437209
	 ))

   ("Wheel"
	("CAR_WHEEL_LF"
	 InverseMass					0.0209
	 DebugId						1
	 IsSteered						1

	 vecDriveAxleJointPos_VF		+0.300	-2.530	+0.220
	 DriveAxleMountOffset			-0.050
	 vecSteeringAxis_VF				+1.000	+0.000	+0.000

	 WishboneLength					+0.440

	 vecJointMount_VF				+0.315	-2.505	+0.105
	 vecJointAxis_VF				+0.000	-1.000	+0.000
	 vecSteeringMount_VF			+0.275	-2.385	+0.155		; LF

	 vecStrutRodMount_SF			-0.012	+0.115	+0.077
	 vecStrutHubPoint_SF			+0.075	+0.000	+0.110
	 vecStrutHubAxis_SF				+1.000	+0.000	+0.000
	 StrutDimX						-0.090
	 StrutDimZ						+0.465
	 ;StrutDimZ						+0.320
	 WishboneSign					-1.000
	 SteeringSign					-1.000

	 AntiRollBarId					0
	 AntiRollBarSlot				0

	 vecTopMountDeformUpAxis_RF		0.000	0.000	1.000
	 vecTopMountDeformSideAxis_RF	-1.000	0.000	0.000
	 TopMountMaxDeformSide			0.050
	 TopMountMaxDeformUp			0.050

	 vecPosOffset_NGP				-0.020	+0.005	+0.000
	 BumpStopRebound_NGP			1.00

	 SpringDamper
	 ("SpringDamper"
	  InnerBumpRubberPos			0.140
	  OuterBumpRubberPos			0.420
	  DampingBumpRubber				20000
	  BumpRubberStiffness			270000
	  DroopStiffness				600000
	  )

	 Tyre
	 ("Tyre"
	  DebugId						0
	  Performance_NGP				1.0
	  CarcassRadius_NGP				0.305
	  TreadDepth_NGP				0.010
	  CarcassWidth_NGP				0.165
	  TreadWidth_NGP				0.145
	  SideWallHeight_NGP			0.108
	  HubOffset_NGP					-0.038
	  )))

   ("Wheel"
	("CAR_WHEEL_RF"
	 InverseMass					0.0209
	 DebugId						2
	 IsSteered						1

	 vecDriveAxleJointPos_VF		-0.300	-2.530	+0.220
	 DriveAxleMountOffset			-0.050
	 vecSteeringAxis_VF				+1.000	+0.000	+0.000

	 WishboneLength					+0.440

	 vecJointMount_VF				-0.315	-2.505	+0.105
	 vecJointAxis_VF				+0.000	-1.000	+0.000
	 vecSteeringMount_VF			-0.275	-2.385	+0.155		; RF

	 vecStrutRodMount_SF			-0.012	-0.115	+0.077
	 vecStrutHubPoint_SF			+0.075	+0.000	+0.110
	 vecStrutHubAxis_SF				+1.000	+0.000	+0.000
	 StrutDimX						-0.090
	 StrutDimZ						+0.465
	 ;StrutDimZ						+0.320
	 WishboneSign					+1.000
	 SteeringSign					+1.000

	 AntiRollBarId					0
	 AntiRollBarSlot				1

	 vecTopMountDeformUpAxis_RF		0.000	0.000	1.000
	 vecTopMountDeformSideAxis_RF	1.000	0.000	0.000
	 TopMountMaxDeformSide			0.050
	 TopMountMaxDeformUp			0.050

	 vecPosOffset_NGP				+0.020	+0.005	+0.000
	 BumpStopRebound_NGP			1.00

	 SpringDamper
	 ("SpringDamper"
	  InnerBumpRubberPos			0.140
	  OuterBumpRubberPos			0.420
	  DampingBumpRubber				20000
	  BumpRubberStiffness			270000
	  DroopStiffness				600000
	  )

	 Tyre
	 ("Tyre"
	  DebugId						1
	  Performance_NGP				1.0
	  CarcassRadius_NGP				0.305
	  TreadDepth_NGP				0.010
	  CarcassWidth_NGP				0.165
	  TreadWidth_NGP				0.145
	  SideWallHeight_NGP			0.108
	  HubOffset_NGP					-0.038
	  )))

   ("Wheel"
	("CAR_WHEEL_LB"
	 InverseMass					0.0252
	 DebugId						3
	 IsSteered						0

	 vecDriveAxleJointPos_VF		+0.300	+0.000	+0.220
	 DriveAxleMountOffset			-0.050
	 vecSteeringAxis_VF				+1.000	+0.000	+0.000

	 WishboneLength					+0.540

	 vecJointMount_VF				+0.220	+0.000	+0.095
	 vecJointAxis_VF				+0.000	-1.000	+0.000
	 vecSteeringMount_VF			+0.220	-0.435	+0.095

	 vecStrutRodMount_SF			+0.000	-0.150	+0.000
	 vecStrutHubPoint_SF			+0.065	+0.000	+0.110
	 vecStrutHubAxis_SF				+1.000	+0.000	+0.000
	 StrutDimX						-0.130
	 StrutDimZ						+0.505
	 ;StrutDimZ						+0.360
	 WishboneSign					-1.000
	 SteeringSign					+1.000

	 AntiRollBarId					1
	 AntiRollBarSlot				0

	 vecTopMountDeformUpAxis_RF		0.000	0.000	1.000
	 vecTopMountDeformSideAxis_RF	-1.000	0.000	0.000
	 TopMountMaxDeformSide			0.050
	 TopMountMaxDeformUp			0.050

	 vecPosOffset_NGP				-0.020	+0.015	+0.000
	 BumpStopRebound_NGP			1.00

	 SpringDamper
	 ("SpringDamper"
	  InnerBumpRubberPos			0.140
	  OuterBumpRubberPos			0.420
	  DampingBumpRubber				17000
	  BumpRubberStiffness			220000
	  DroopStiffness				600000
	  )

	 Tyre
	 ("Tyre"
	  DebugId						2
	  Performance_NGP				1.0
	  CarcassRadius_NGP				0.305
	  TreadDepth_NGP				0.010
	  CarcassWidth_NGP				0.165
	  TreadWidth_NGP				0.145
	  SideWallHeight_NGP			0.108
	  HubOffset_NGP					-0.038
	  )))

   ("Wheel"
	("CAR_WHEEL_RB"
	 InverseMass					0.0252
	 DebugId						4
	 IsSteered						0

	 vecDriveAxleJointPos_VF		-0.300	+0.000	+0.220
	 DriveAxleMountOffset			-0.050
	 vecSteeringAxis_VF				+1.000	+0.000	+0.000

	 WishboneLength					+0.540

	 vecJointMount_VF				-0.220	+0.000	+0.095
	 vecJointAxis_VF				+0.000	-1.000	+0.000
	 vecSteeringMount_VF			-0.220	-0.435	+0.095

	 vecStrutRodMount_SF			+0.000	+0.150	+0.000
	 vecStrutHubPoint_SF			+0.065	+0.000	+0.110
	 vecStrutHubAxis_SF				+1.000	+0.000	+0.000
	 StrutDimX						-0.130
	 StrutDimZ						+0.505
	 ;StrutDimZ						+0.360
	 WishboneSign					+1.000
	 SteeringSign					-1.000

	 AntiRollBarId					1
	 AntiRollBarSlot				1

	 vecTopMountDeformUpAxis_RF		0.000	0.000	1.000
	 vecTopMountDeformSideAxis_RF	1.000	0.000	0.000
	 TopMountMaxDeformSide			0.050
	 TopMountMaxDeformUp			0.050

	 vecPosOffset_NGP				+0.020	+0.015	+0.000
	 BumpStopRebound_NGP			1.00

	 SpringDamper
	 ("SpringDamper"
	  InnerBumpRubberPos			0.140
	  OuterBumpRubberPos			0.420
	  DampingBumpRubber				17000
	  BumpRubberStiffness			220000
	  DroopStiffness				600000
	  )

	 Tyre
	 ("Tyre"
	  DebugId						3
	  Performance_NGP				1.0
	  CarcassRadius_NGP				0.305
	  TreadDepth_NGP				0.010
	  CarcassWidth_NGP				0.165
	  TreadWidth_NGP				0.145
	  SideWallHeight_NGP			0.108
	  HubOffset_NGP					-0.038
	  )))
   )
))
